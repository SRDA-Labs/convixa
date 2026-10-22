/**
 * Phase 5 governance — delays, twins, webhooks, simulations, certification exports.
 */

import { eq, and, desc, isNull, sql, inArray } from "drizzle-orm";
import { db } from "../index";
import {
  safeDelayAttachments,
  orgGovernanceSettings,
  safeEnvironmentPairs,
  safeWebhookSubscriptions,
  webhookEventInbox,
  txSimulationCache,
  certificationExports,
  safes,
  safeSnapshots,
} from "../schema";
import { firstOrNull } from "../utils/queries";
import { randomBytes } from "crypto";

// ─── Delay attachments ───────────────────────────────────────────────────────

export async function getDelayAttachmentsBySafe(safeId: string) {
  return db
    .select()
    .from(safeDelayAttachments)
    .where(eq(safeDelayAttachments.safeId, safeId))
    .orderBy(desc(safeDelayAttachments.detectedAt));
}

export async function getDelayAttachmentsByOrg(orgId: string) {
  return db
    .select()
    .from(safeDelayAttachments)
    .where(eq(safeDelayAttachments.orgId, orgId));
}

export async function upsertDelayAttachments(
  orgId: string,
  safeId: string,
  rows: Array<{
    attachmentType: string;
    moduleAddress: string;
    delaySeconds: number | null;
    metadataJson?: Record<string, unknown>;
  }>
) {
  const now = new Date();
  const moduleAddresses = new Set(rows.map((r) => r.moduleAddress.toLowerCase()));
  const existing = await getDelayAttachmentsBySafe(safeId);

  for (const row of existing) {
    const addr = row.moduleAddress?.toLowerCase() ?? "";
    if (!moduleAddresses.has(addr)) {
      await db.delete(safeDelayAttachments).where(eq(safeDelayAttachments.id, row.id));
    }
  }

  for (const row of rows) {
    const [existing] = await db
      .select({ id: safeDelayAttachments.id })
      .from(safeDelayAttachments)
      .where(
        and(
          eq(safeDelayAttachments.safeId, safeId),
          sql`lower(${safeDelayAttachments.moduleAddress}) = ${row.moduleAddress.toLowerCase()}`
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(safeDelayAttachments)
        .set({
          attachmentType: row.attachmentType,
          delaySeconds: row.delaySeconds,
          metadataJson: row.metadataJson ?? null,
          lastVerifiedAt: now,
          updatedAt: now,
        })
        .where(eq(safeDelayAttachments.id, existing.id));
    } else {
      await db.insert(safeDelayAttachments).values({
        orgId,
        safeId,
        attachmentType: row.attachmentType,
        moduleAddress: row.moduleAddress,
        delaySeconds: row.delaySeconds,
        metadataJson: row.metadataJson ?? null,
        source: "snapshot",
        detectedAt: now,
        lastVerifiedAt: now,
      });
    }
  }
}

export async function countSafesWithDelays(orgId: string): Promise<number> {
  const rows = await db
    .select({ safeId: safeDelayAttachments.safeId })
    .from(safeDelayAttachments)
    .where(eq(safeDelayAttachments.orgId, orgId))
    .groupBy(safeDelayAttachments.safeId);
  return rows.length;
}

// ─── Governance settings ─────────────────────────────────────────────────────

export async function getOrCreateGovernanceSettings(orgId: string) {
  const [row] = await db
    .select()
    .from(orgGovernanceSettings)
    .where(eq(orgGovernanceSettings.orgId, orgId))
    .limit(1);

  if (row) return row;

  const [created] = await db
    .insert(orgGovernanceSettings)
    .values({ orgId })
    .returning();
  return created;
}

export async function updateGovernanceSettings(
  orgId: string,
  data: Partial<{
    minDelaySecondsTreasury: number;
    minDelaySecondsProtocol: number;
    requireTimelockProtocolCritical: boolean;
  }>
) {
  await getOrCreateGovernanceSettings(orgId);
  const [row] = await db
    .update(orgGovernanceSettings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(orgGovernanceSettings.orgId, orgId))
    .returning();
  return row;
}

// ─── Testnet twins ───────────────────────────────────────────────────────────

export async function getEnvironmentPairsByOrg(orgId: string) {
  return db
    .select({
      pair: safeEnvironmentPairs,
      production: safes,
    })
    .from(safeEnvironmentPairs)
    .innerJoin(safes, eq(safeEnvironmentPairs.productionSafeId, safes.id))
    .where(eq(safeEnvironmentPairs.orgId, orgId))
    .orderBy(desc(safeEnvironmentPairs.createdAt));
}

export async function getTwinForProductionSafe(productionSafeId: string) {
  const rows = await db
    .select()
    .from(safeEnvironmentPairs)
    .where(eq(safeEnvironmentPairs.productionSafeId, productionSafeId))
    .limit(1);
  return firstOrNull(rows);
}

export async function createEnvironmentPair(data: {
  orgId: string;
  productionSafeId: string;
  twinSafeId: string;
  twinNetwork: string;
  purpose?: string;
  linkedByUserId?: string | null;
}) {
  const [row] = await db
    .insert(safeEnvironmentPairs)
    .values({
      orgId: data.orgId,
      productionSafeId: data.productionSafeId,
      twinSafeId: data.twinSafeId,
      twinNetwork: data.twinNetwork,
      purpose: data.purpose ?? "staging",
      linkedByUserId: data.linkedByUserId ?? null,
    })
    .returning();
  return row;
}

export async function deleteEnvironmentPair(id: string, orgId: string) {
  const [row] = await db
    .delete(safeEnvironmentPairs)
    .where(and(eq(safeEnvironmentPairs.id, id), eq(safeEnvironmentPairs.orgId, orgId)))
    .returning();
  return firstOrNull([row]);
}

export async function countStrictSafesWithTwins(orgId: string): Promise<{
  strictTotal: number;
  withTwin: number;
}> {
  const strictSafes = await db
    .select({ id: safes.id })
    .from(safes)
    .where(
      and(
        eq(safes.orgId, orgId),
        inArray(safes.classification, ["treasury", "protocol_critical"])
      )
    );
  const strictIds = strictSafes.map((s) => s.id);
  if (strictIds.length === 0) return { strictTotal: 0, withTwin: 0 };

  const pairs = await db
    .select({ productionSafeId: safeEnvironmentPairs.productionSafeId })
    .from(safeEnvironmentPairs)
    .where(
      and(
        eq(safeEnvironmentPairs.orgId, orgId),
        inArray(safeEnvironmentPairs.productionSafeId, strictIds)
      )
    );
  const unique = new Set(pairs.map((p) => p.productionSafeId));
  return { strictTotal: strictIds.length, withTwin: unique.size };
}

// ─── Webhooks ────────────────────────────────────────────────────────────────

export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

export async function getWebhookSubscriptionsByOrg(orgId: string) {
  return db
    .select()
    .from(safeWebhookSubscriptions)
    .where(eq(safeWebhookSubscriptions.orgId, orgId))
    .orderBy(desc(safeWebhookSubscriptions.createdAt));
}

export async function getWebhookSubscriptionBySecret(secret: string) {
  const rows = await db
    .select()
    .from(safeWebhookSubscriptions)
    .where(
      and(
        eq(safeWebhookSubscriptions.webhookSecret, secret),
        eq(safeWebhookSubscriptions.status, "active")
      )
    )
    .limit(1);
  return firstOrNull(rows);
}

export async function createWebhookSubscription(data: {
  orgId: string;
  safeId?: string | null;
  network: string;
  safeAddress: string;
  eventTypes?: string[];
}) {
  const secret = generateWebhookSecret();
  const [row] = await db
    .insert(safeWebhookSubscriptions)
    .values({
      orgId: data.orgId,
      safeId: data.safeId ?? null,
      network: data.network,
      safeAddress: data.safeAddress.toLowerCase(),
      webhookSecret: secret,
      eventTypesJson: data.eventTypes ?? ["INCOMING_TRANSACTION", "CONFIRMATION", "EXECUTION"],
      status: "active",
    })
    .returning();
  return row;
}

export async function deleteWebhookSubscription(id: string, orgId: string) {
  const [row] = await db
    .delete(safeWebhookSubscriptions)
    .where(and(eq(safeWebhookSubscriptions.id, id), eq(safeWebhookSubscriptions.orgId, orgId)))
    .returning();
  return firstOrNull([row]);
}

export async function touchWebhookReceived(subscriptionId: string) {
  await db
    .update(safeWebhookSubscriptions)
    .set({ lastReceivedAt: new Date(), updatedAt: new Date() })
    .where(eq(safeWebhookSubscriptions.id, subscriptionId));
}

export async function insertWebhookEvent(data: {
  orgId: string;
  subscriptionId?: string | null;
  eventType: string;
  payloadJson: Record<string, unknown>;
  safeAddress?: string | null;
  safeTxHash?: string | null;
}) {
  const [row] = await db.insert(webhookEventInbox).values(data).returning();
  return row;
}

export async function getUnprocessedWebhookEvents(limit = 50) {
  return db
    .select()
    .from(webhookEventInbox)
    .where(isNull(webhookEventInbox.processedAt))
    .orderBy(webhookEventInbox.receivedAt)
    .limit(limit);
}

export async function markWebhookEventProcessed(id: string, error?: string) {
  await db
    .update(webhookEventInbox)
    .set({
      processedAt: new Date(),
      processingError: error ?? null,
    })
    .where(eq(webhookEventInbox.id, id));
}

export async function countActiveWebhooks(orgId: string): Promise<number> {
  const rows = await db
    .select({ id: safeWebhookSubscriptions.id })
    .from(safeWebhookSubscriptions)
    .where(
      and(
        eq(safeWebhookSubscriptions.orgId, orgId),
        eq(safeWebhookSubscriptions.status, "active")
      )
    );
  return rows.length;
}

// ─── Simulation cache ────────────────────────────────────────────────────────

export async function getSimulationCache(
  safeId: string,
  safeTxHash: string,
  blockNumber?: number | null
) {
  const rows = await db
    .select()
    .from(txSimulationCache)
    .where(
      and(
        eq(txSimulationCache.safeId, safeId),
        eq(txSimulationCache.safeTxHash, safeTxHash),
        blockNumber != null
          ? eq(txSimulationCache.blockNumber, blockNumber)
          : isNull(txSimulationCache.blockNumber)
      )
    )
    .limit(1);
  const row = firstOrNull(rows);
  if (row?.expiresAt && row.expiresAt < new Date()) return null;
  return row;
}

export async function upsertSimulationCache(data: {
  orgId: string;
  safeId: string;
  safeTxHash: string;
  network: string;
  blockNumber?: number | null;
  status: string;
  resultJson: Record<string, unknown>;
  expiresAt?: Date | null;
}) {
  const existing = await getSimulationCache(data.safeId, data.safeTxHash, data.blockNumber);
  if (existing) {
    const [row] = await db
      .update(txSimulationCache)
      .set({
        status: data.status,
        resultJson: data.resultJson,
        simulatedAt: new Date(),
        expiresAt: data.expiresAt ?? null,
      })
      .where(eq(txSimulationCache.id, existing.id))
      .returning();
    return row;
  }

  const [row] = await db.insert(txSimulationCache).values(data).returning();
  return row;
}

export async function countPendingWithoutSimulation(orgId: string): Promise<number> {
  const strictRows = await db
    .select({
      safeId: safes.id,
      pendingCount: safeSnapshots.pendingCount,
    })
    .from(safes)
    .innerJoin(safeSnapshots, eq(safes.id, safeSnapshots.safeId))
    .where(
      and(
        eq(safes.orgId, orgId),
        inArray(safes.classification, ["treasury", "protocol_critical"]),
        sql`${safeSnapshots.pendingCount} > 0`
      )
    );

  if (strictRows.length === 0) return 0;

  const safeIds = strictRows.map((r) => r.safeId);
  const sims = await db
    .select({ safeId: txSimulationCache.safeId })
    .from(txSimulationCache)
    .where(
      and(
        inArray(txSimulationCache.safeId, safeIds),
        eq(txSimulationCache.status, "success")
      )
    );
  const withSim = new Set(sims.map((s) => s.safeId));
  return strictRows.filter((r) => !withSim.has(r.safeId)).length;
}

// ─── Certification exports ───────────────────────────────────────────────────

export async function saveCertificationExport(data: {
  orgId: string;
  exportedByUserId?: string | null;
  manifestJson: Record<string, unknown>;
}) {
  const [row] = await db.insert(certificationExports).values(data).returning();
  return row;
}

export async function getLatestCertificationExport(orgId: string) {
  const rows = await db
    .select()
    .from(certificationExports)
    .where(eq(certificationExports.orgId, orgId))
    .orderBy(desc(certificationExports.createdAt))
    .limit(1);
  return firstOrNull(rows);
}

export async function getCertificationExports(orgId: string, limit = 10) {
  return db
    .select()
    .from(certificationExports)
    .where(eq(certificationExports.orgId, orgId))
    .orderBy(desc(certificationExports.createdAt))
    .limit(limit);
}

// ─── Helpers for policy gap ──────────────────────────────────────────────────

export async function getSafesWithSnapshots(orgId: string) {
  return db
    .select({
      safe: safes,
      snapshot: safeSnapshots,
    })
    .from(safes)
    .leftJoin(safeSnapshots, eq(safes.id, safeSnapshots.safeId))
    .where(eq(safes.orgId, orgId));
}
