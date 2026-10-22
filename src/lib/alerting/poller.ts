/**
 * Safe poller: fetch pending multisig transactions, persist raw txs, classify and emit normalized events,
 * and enforce policies against pending transactions.
 *
 * Uses the MultisigProvider abstraction to fetch data, so the poller works with any
 * multisig implementation (Safe, Zodiac, etc.) without code changes.
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  rawTransactions,
  normalizedEvents,
  safes,
} from "../db/schema";
import { getProviderFor } from "../multisig-provider";
import type { MultisigImplementation, PendingMultisigTx } from "../multisig-provider";
import { getAddress } from "viem";
import { classifyTransaction } from "./classifier";
import {
  refreshSignerQueueCacheForSafe,
  type PendingTxForCache,
} from "../signer-queue/cache-refresher";
import type { PendingTxInput } from "../policy-engine/types";
import type { SafePendingData } from "../policy-engine/enforcer";

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (i < MAX_RETRIES - 1) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, i);
        console.warn("[alerting/poller] Retry after", backoff, "ms:", lastError.message);
        await sleep(backoff);
      }
    }
  }
  throw lastError;
}

function toChecksum(addr: string): string {
  try {
    return getAddress(addr);
  } catch {
    return addr;
  }
}

/**
 * Run one poll cycle: for each safe, fetch pending txs via its provider,
 * insert new raw txs, classify and insert normalized events.
 * Returns count of new normalized events created.
 */
export async function runPollCycle(): Promise<{ processed: number; newEvents: number; errors: string[]; enforcement: { alertsCreated: number; violationsCreated: number; errors: string[] } }> {
  const errors: string[] = [];
  let newEvents = 0;

  const safeList = await db
    .select({ id: safes.id, address: safes.address, network: safes.network, orgId: safes.orgId, implementation: safes.implementation, name: safes.name })
    .from(safes);

  // Collect pending tx data per org for policy enforcement
  const perOrgData = new Map<string, SafePendingData[]>();

  for (const safe of safeList) {
    try {
      const provider = getProviderFor(safe.implementation as MultisigImplementation, safe.network);
      const pending = await fetchWithRetry(() =>
        provider.fetchPendingTransactions(safe.network, safe.address)
      );

      // Collect for policy enforcement
      if (safe.orgId) {
        const pendingTxInputs: PendingTxInput[] = pending.map((tx) => ({
          to: tx.to,
          value: tx.value,
          data: tx.data ?? null,
          operation: tx.operation,
          safeTxHash: tx.txHash,
          confirmations: tx.confirmations?.length,
          confirmationsRequired: tx.confirmationsRequired,
          proposedBy: tx.proposedBy ?? undefined,
          nonce: tx.nonce ?? undefined,
        }));
        const orgData = perOrgData.get(safe.orgId) ?? [];
        orgData.push({
          safeId: safe.id,
          safeAddress: safe.address,
          network: safe.network,
          safeName: safe.name ?? null,
          pendingTxs: pendingTxInputs,
          implementation: safe.implementation ?? undefined,
        });
        perOrgData.set(safe.orgId, orgData);
      }

      // Refresh the signer queue cache with the fetched pending txs
      try {
        const queueTxs: PendingTxForCache[] = pending.map((tx) => ({
          safeTxHash: tx.txHash,
          confirmations: tx.confirmations.map((owner) => ({ owner, signature: "" })),
        }));
        await refreshSignerQueueCacheForSafe(safe.id, safe.orgId ?? "", queueTxs);
      } catch (queueErr: unknown) {
        const qMsg = queueErr instanceof Error ? queueErr.message : String(queueErr);
        console.warn("[alerting/poller] Queue cache refresh failed for safe", safe.id, ":", qMsg);
      }

      for (const tx of pending) {
        const safeTxHash = tx.txHash;
        if (!safeTxHash) continue;

        const existing = await db
          .select({ id: rawTransactions.id })
          .from(rawTransactions)
          .where(eq(rawTransactions.safeTxHash, safeTxHash))
          .limit(1);

        if (existing.length > 0) continue;

        const proposedBy = tx.proposedBy ?? toChecksum(safe.address);
        const nonce = tx.nonce ?? 0;
        const toAddress = toChecksum(tx.to);
        const value = tx.value;
        const data = tx.data ?? null;
        const operation = tx.operation;

        await db.insert(rawTransactions).values({
          safeId: safe.id,
          safeTxHash,
          toAddress,
          value,
          data,
          operation,
          proposedBy,
          nonce,
        });

        const classified = classifyTransaction({
          safeId: safe.id,
          safeAddress: safe.address,
          safeTxHash,
          toAddress,
          value,
          data,
          operation,
          proposedBy,
          nonce,
        });

        let insertedId: string | null = null;
        try {
          const [row] = await db
            .insert(normalizedEvents)
            .values({
              safeId: safe.id,
              safeTxHash,
              eventType: classified.eventType,
              category: classified.category,
              metadata: classified.metadata as unknown as Record<string, unknown>,
            })
            .returning({ id: normalizedEvents.id });
          if (row) {
            insertedId = row.id;
            newEvents++;
          }
        } catch (insertErr: unknown) {
          const msg = insertErr instanceof Error ? insertErr.message : String(insertErr);
          if (msg.includes("unique") || msg.includes("duplicate")) {
            // Idempotent: already have this (safeTxHash, eventType)
          } else {
            errors.push(`normalized_event ${safeTxHash}: ${msg}`);
          }
        }
        if (insertedId) {
          const { dispatchAlertsForEvent } = await import("./dispatcher");
          const dr = await dispatchAlertsForEvent(insertedId);
          if (dr.errors.length > 0) errors.push(...dr.errors);

          try {
            const { maybeAutoOpenOobCase } = await import(
              "@/lib/operational-workflows/oob-auto-open"
            );
            await maybeAutoOpenOobCase({
              safeId: safe.id,
              safeTxHash,
              eventType: classified.eventType,
              normalizedEventId: insertedId,
            });
          } catch (oobErr) {
            const msg = oobErr instanceof Error ? oobErr.message : String(oobErr);
            errors.push(`oob_auto_open ${safeTxHash}: ${msg}`);
          }
        }
      }

      // Persist executed transaction history for policy engine conditions
      try {
        const history = await fetchWithRetry(() =>
          provider.fetchTransactionHistory(safe.network, safe.address, 100)
        );
        if (history.length > 0) {
          const { persistTransactionHistory } = await import(
            "../db/repositories/transaction-history.repository"
          );
          const result = await persistTransactionHistory(
            safe.id,
            history.map((tx) => ({
              safeTxHash: tx.txHash,
              toAddress: tx.to,
              valueWei: tx.value,
              nonce: tx.nonce ?? 0,
              data: tx.data,
              operation: tx.operation,
              executedAt: tx.submissionDate ? new Date(tx.submissionDate) : new Date(),
              executionTxHash: null,
            }))
          );
          if (result.inserted > 0) {
            const { backfillConfigEventsFromHistory } = await import("../safe-config/history");
            await backfillConfigEventsFromHistory(safe.id, 50);
          }
        }
      } catch (histErr: unknown) {
        const hMsg = histErr instanceof Error ? histErr.message : String(histErr);
        console.warn("[alerting/poller] History persistence failed for safe", safe.id, ":", hMsg);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`safe ${safe.address}: ${msg}`);
    }
  }

  // ── Policy Enforcement ──────────────────────────────────────────────
  const enforcement = { alertsCreated: 0, violationsCreated: 0, errors: [] as string[] };
  if (perOrgData.size > 0) {
    try {
      const { runPolicyEnforcement } = await import("../policy-engine/enforcer");
      const enfResults = await runPolicyEnforcement(perOrgData);
      for (const r of enfResults) {
        enforcement.alertsCreated += r.alertsCreated;
        enforcement.violationsCreated += r.violationsCreated;
        enforcement.errors.push(...r.errors);
      }
      // Dispatch notifications for newly created policy fire logs
      try {
        const { dispatchPolicyNotifications } = await import("./policy-notifications");
        const notifResult = await dispatchPolicyNotifications();
        if (notifResult.errors.length > 0) enforcement.errors.push(...notifResult.errors);
      } catch (notifErr: unknown) {
        const nMsg = notifErr instanceof Error ? notifErr.message : String(notifErr);
        console.warn("[alerting/poller] Policy notification dispatch failed:", nMsg);
      }
    } catch (enfErr: unknown) {
      const enfMsg = enfErr instanceof Error ? enfErr.message : String(enfErr);
      enforcement.errors.push(`Policy enforcement failed: ${enfMsg}`);
    }
  }

  return {
    processed: safeList.length,
    newEvents,
    errors,
    enforcement,
  };
}
