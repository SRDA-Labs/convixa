/**
 * Signer Queue Cache Refresher
 *
 * Updates signer_queue_cache rows during the poll cycle so the personal
 * signer dashboard and overview queue widget have fast reads without
 * needing to hit the Safe Transaction Service on every page load.
 *
 * This is designed to accept already-fetched pending transactions from
 * the poller to avoid redundant API calls.
 */

import { db } from "@/lib/db";
import { safeSnapshots } from "@/lib/db/schema";
import { sql, eq } from "drizzle-orm";
import { upsertQueueCache, deleteQueueCacheBySafe } from "@/lib/db/repositories";

export interface PendingTxForCache {
  safeTxHash: string;
  confirmations: Array<{ owner?: string }>;
}

/**
 * Refresh the queue cache for a single Safe.
 *
 * @param safeId     - The Safe's database ID
 * @param orgId      - The org the Safe belongs to
 * @param pendingTxs - Already-fetched pending transactions from the poller
 */
export async function refreshSignerQueueCacheForSafe(
  safeId: string,
  orgId: string,
  pendingTxs: PendingTxForCache[]
): Promise<void> {
  // 1. Get the Safe's signer list from the snapshot
  const [snapshot] = await db
    .select({ owners: safeSnapshots.owners })
    .from(safeSnapshots)
    .where(eq(safeSnapshots.safeId, safeId))
    .limit(1);

  if (!snapshot?.owners || !Array.isArray(snapshot.owners)) {
    // No snapshot yet — clear any stale cache entries
    await deleteQueueCacheBySafe(safeId);
    return;
  }

  const owners: string[] = snapshot.owners.map((o: string) => o.toLowerCase());

  // 2. For each owner, count pending txs NOT yet confirmed by them
  const pendingByOwner = new Map<string, { count: number; txHashes: string[] }>();

  for (const owner of owners) {
    pendingByOwner.set(owner, { count: 0, txHashes: [] });
  }

  for (const tx of pendingTxs) {
    if (!tx.safeTxHash) continue;
    const confirmations = tx.confirmations ?? [];
    const confirmedOwners = new Set(
      confirmations
        .map((c) => c.owner?.toLowerCase())
        .filter((o): o is string => !!o)
    );

    for (const owner of owners) {
      if (!confirmedOwners.has(owner)) {
        const entry = pendingByOwner.get(owner)!;
        entry.count++;
        entry.txHashes.push(tx.safeTxHash);
      }
    }
  }

  // 3. Upsert into signer_queue_cache for each owner
  for (const [owner, { count, txHashes }] of pendingByOwner) {
    await upsertQueueCache({
      walletAddress: owner,
      safeId,
      orgId,
      pendingCount: count,
      pendingTxHashes: txHashes,
    });
  }
}

/**
 * Refresh the queue cache for all Safes belonging to an org.
 *
 * This is called after the poll cycle completes for an org.
 * It requires the already-fetched pending txs grouped by safeId.
 *
 * @param orgId      - The org ID
 * @param safeData   - Map of safeId → already-fetched pending transactions
 */
export async function refreshSignerQueueCacheForOrg(
  orgId: string,
  safeData: Map<string, PendingTxForCache[]>
): Promise<void> {
  for (const [safeId, pendingTxs] of safeData) {
    await refreshSignerQueueCacheForSafe(safeId, orgId, pendingTxs);
  }
}
