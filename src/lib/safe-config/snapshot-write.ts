/**
 * Shared helper to write safe_snapshots with security attachments.
 */

import { db } from "@/lib/db";
import { safeSnapshots } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { fetchSafeSecurityAttachments } from "@/lib/safe-api";
import { detectAndRecordSnapshotDiff } from "./snapshot-diff";

export type WriteSnapshotInput = {
  safeId: string;
  orgId: string;
  network: string;
  address: string;
  threshold: number;
  owners: string[];
  nonce: number;
  pendingCount: number;
  lastTxAt: Date | null;
  implementationVersion?: string | null;
  balances?: unknown;
  rawResponse?: unknown;
};

export async function writeSafeSnapshot(input: WriteSnapshotInput): Promise<Date> {
  const [prev] = await db
    .select()
    .from(safeSnapshots)
    .where(eq(safeSnapshots.safeId, input.safeId))
    .limit(1);

  let security: Awaited<ReturnType<typeof fetchSafeSecurityAttachments>> = {
    guard: null,
    fallbackHandler: null,
    modules: [],
  };
  try {
    security = await fetchSafeSecurityAttachments(input.network, input.address);
  } catch {
    // non-critical
  }

  const modulesJson = security.modules.map((m) => ({
    address: m.address,
    ...(m.name ? { name: m.name } : {}),
  }));

  if (prev) {
    await detectAndRecordSnapshotDiff(
      input.safeId,
      input.orgId,
      {
        threshold: prev.threshold,
        owners: prev.owners as string[] | null,
        guardAddress: prev.guardAddress,
        fallbackHandler: prev.fallbackHandler,
        modulesJson: (prev.modulesJson as { address: string }[] | null) ?? null,
      },
      {
        threshold: input.threshold,
        owners: input.owners,
        guardAddress: security.guard,
        fallbackHandler: security.fallbackHandler,
        modulesJson,
      }
    );
    await db.delete(safeSnapshots).where(eq(safeSnapshots.safeId, input.safeId));
  }

  const now = new Date();
  await db.insert(safeSnapshots).values({
    safeId: input.safeId,
    threshold: input.threshold,
    owners: input.owners,
    nonce: input.nonce,
    balances: input.balances ?? null,
    pendingCount: input.pendingCount,
    lastTxAt: input.lastTxAt,
    implementationVersion: input.implementationVersion ?? null,
    guardAddress: security.guard,
    fallbackHandler: security.fallbackHandler,
    modulesJson,
    lastOwnersCount: input.owners.length,
    rawResponse: input.rawResponse ?? null,
    refreshedAt: now,
  });

  if (!prev) {
    const { upsertAlertSafeState } = await import("@/lib/db/repositories/alerts.repository");
    await upsertAlertSafeState({
      safeId: input.safeId,
      lastOwnersJson: input.owners.map((o) => o.toLowerCase()),
      lastThreshold: input.threshold,
    });
  }

  try {
    const { upsertRosterFromSnapshot } = await import(
      "@/lib/db/repositories/safe-signer-roster.repository"
    );
    await upsertRosterFromSnapshot({
      orgId: input.orgId,
      safeId: input.safeId,
      owners: input.owners,
    });
  } catch (e) {
    console.warn("[snapshot-write] roster sync failed:", e);
  }

  try {
    const { syncDelaysFromSnapshot } = await import("@/lib/governance-delay/sync-delays");
    await syncDelaysFromSnapshot({
      orgId: input.orgId,
      safeId: input.safeId,
      modulesJson,
      guardAddress: security.guard,
    });
  } catch (e) {
    console.warn("[snapshot-write] delay sync failed:", e);
  }

  return now;
}
