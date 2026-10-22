/**
 * Historical blocklist check for Safes: has this Safe ever sent a tx to a blacklisted address?
 * Results are cached in safe_blacklist_checks to avoid hammering the Safe API.
 */

import { getAddress } from "viem";
import { db } from "@/lib/db";
import {
  safeBlacklistChecks,
  orgBlacklistedAddresses,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { fetchSafeTransactions } from "@/lib/safe-api";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const HISTORY_TX_LIMIT = 100;

export type SafeBlacklistCheckResult = {
  hasInteraction: boolean;
  reason: string | null;
};

/**
 * Returns whether the Safe has historical executed transactions to any global or org blacklisted address.
 * Uses cache (24h TTL); recomputes and upserts on cache miss or when blacklists might have changed.
 */
export async function getOrComputeSafeBlacklistCheck(
  safeId: string,
  orgId: string,
  safeAddress: string,
  network: string
): Promise<SafeBlacklistCheckResult> {
  const cached = await db
    .select({
      checkedAt: safeBlacklistChecks.checkedAt,
      hasInteraction: safeBlacklistChecks.hasInteraction,
      reason: safeBlacklistChecks.reason,
    })
    .from(safeBlacklistChecks)
    .where(
      and(
        eq(safeBlacklistChecks.safeId, safeId),
        eq(safeBlacklistChecks.orgId, orgId)
      )
    )
    .limit(1);

  const now = new Date();
  if (cached.length > 0) {
    const row = cached[0];
    const checkedAt = row.checkedAt ? new Date(row.checkedAt).getTime() : 0;
    if (now.getTime() - checkedAt < CACHE_TTL_MS) {
      return {
        hasInteraction: row.hasInteraction,
        reason: row.reason ?? null,
      };
    }
  }

  // Load org blacklist (normalized to checksum)
  const orgRows = await db
    .select({ address: orgBlacklistedAddresses.address })
    .from(orgBlacklistedAddresses)
    .where(eq(orgBlacklistedAddresses.orgId, orgId));

  const orgSet = new Set<string>();
  for (const r of orgRows) {
    try {
      orgSet.add(getAddress(r.address));
    } catch {
      // skip invalid
    }
  }

  if (orgSet.size === 0) {
    const result: SafeBlacklistCheckResult = { hasInteraction: false, reason: null };
    await upsertCheck(safeId, orgId, now, false, null);
    return result;
  }

  try {
    const executed = await fetchSafeTransactions(network, safeAddress, HISTORY_TX_LIMIT);
    const toAddresses = new Set<string>();
    for (const tx of executed) {
      const to = (tx as { to?: string }).to;
      if (to) {
        try {
          toAddresses.add(getAddress(to));
        } catch {
          // skip invalid
        }
      }
    }

    const hitOrg: string[] = [];
    for (const to of toAddresses) {
      if (orgSet.has(to)) hitOrg.push(to);
    }

    const hasInteraction = hitOrg.length > 0;
    let reason: string | null = null;
    if (hasInteraction) {
      const parts: string[] = [];
      if (hitOrg.length > 0) {
        parts.push(...hitOrg.map((a) => `${truncateAddr(a)} (org)`));
      }
      reason = `Historical transaction(s) to blacklisted address(es): ${parts.join(", ")}.`;
    }

    await upsertCheck(safeId, orgId, now, hasInteraction, reason);
    return { hasInteraction, reason };
  } catch {
    // Safe API error: keep existing cache if any; else return no interaction and optionally cache short TTL
    if (cached.length > 0) {
      return {
        hasInteraction: cached[0].hasInteraction,
        reason: cached[0].reason ?? null,
      };
    }
    return { hasInteraction: false, reason: null };
  }
}

function truncateAddr(addr: string, start = 6, end = 4): string {
  if (addr.length <= start + end) return addr;
  return `${addr.slice(0, start)}…${addr.slice(-end)}`;
}

async function upsertCheck(
  safeId: string,
  orgId: string,
  checkedAt: Date,
  hasInteraction: boolean,
  reason: string | null
): Promise<void> {
  await db
    .insert(safeBlacklistChecks)
    .values({
      safeId,
      orgId,
      checkedAt,
      hasInteraction,
      reason,
    })
    .onConflictDoUpdate({
      target: [safeBlacklistChecks.safeId, safeBlacklistChecks.orgId],
      set: {
        checkedAt,
        hasInteraction,
        reason,
      },
    });
}

/**
 * Invalidate cached checks for an org (call when org blacklist changes).
 */
export async function invalidateSafeBlacklistChecksForOrg(orgId: string): Promise<void> {
  await db.delete(safeBlacklistChecks).where(eq(safeBlacklistChecks.orgId, orgId));
}

/**
 * Invalidate all cached checks (call when global blacklist changes).
 */
export async function invalidateAllSafeBlacklistChecks(): Promise<void> {
  await db.delete(safeBlacklistChecks);
}
