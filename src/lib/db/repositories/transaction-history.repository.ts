/**
 * Transaction History Repository
 *
 * Powers the policy engine's `new_counterparty` and `per_period_spend_usd` conditions.
 * Tracks every executed transaction per Safe so we can answer:
 *   - Has this counterparty been transacted with before?
 *   - How much has this Safe spent this week/month?
 */

import { eq, and, gte, sql } from "drizzle-orm";
import { db } from "../index";
import { safeTransactionHistory } from "../schema/transaction-history.schema";

export interface TxHistoryEntry {
  safeTxHash: string;
  toAddress: string;
  valueWei: string;
  nonce: number;
  data?: string | null;
  operation?: number;
  executedAt: Date;
  executionTxHash?: string | null;
}

/** Persist executed transaction records (idempotent — skips duplicates). */
export async function persistTransactionHistory(
  safeId: string,
  txs: TxHistoryEntry[]
): Promise<{ inserted: number; skipped: number }> {
  if (txs.length === 0) return { inserted: 0, skipped: 0 };

  const existing = await db
    .select({ safeTxHash: safeTransactionHistory.safeTxHash })
    .from(safeTransactionHistory)
    .where(eq(safeTransactionHistory.safeId, safeId));

  const existingSet = new Set(existing.map((r) => r.safeTxHash));
  const toInsert = txs.filter((tx) => !existingSet.has(tx.safeTxHash));

  if (toInsert.length === 0) return { inserted: 0, skipped: txs.length };

  await db.insert(safeTransactionHistory).values(
    toInsert.map((tx) => ({
      safeId,
      safeTxHash: tx.safeTxHash,
      nonce: tx.nonce,
      toAddress: tx.toAddress.toLowerCase(),
      valueWei: tx.valueWei,
      data: tx.data ?? null,
      operation: tx.operation ?? 0,
      executedAt: tx.executedAt,
      executionTxHash: tx.executionTxHash ?? null,
    }))
  );

  return { inserted: toInsert.length, skipped: txs.length - toInsert.length };
}

/**
 * Check if a counterparty address has been interacted with in the lookback window.
 * Returns the earliest interaction date, or null if never seen.
 */
export async function getFirstCounterpartyInteraction(
  safeId: string,
  address: string,
  lookbackDays: number
): Promise<Date | null> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  const rows = await db
    .select({ executedAt: safeTransactionHistory.executedAt })
    .from(safeTransactionHistory)
    .where(
      and(
        eq(safeTransactionHistory.safeId, safeId),
        eq(safeTransactionHistory.toAddress, address.toLowerCase()),
        gte(safeTransactionHistory.executedAt, cutoff)
      )
    )
    .orderBy(safeTransactionHistory.executedAt)
    .limit(1);

  return rows[0]?.executedAt ?? null;
}

/** Total native value sent (in wei) over a given period. */
export async function getPeriodSpend(
  safeId: string,
  period: "day" | "week" | "month"
): Promise<bigint> {
  const now = new Date();
  const cutoff = new Date(now);
  switch (period) {
    case "day": cutoff.setDate(cutoff.getDate() - 1); break;
    case "week": cutoff.setDate(cutoff.getDate() - 7); break;
    case "month": cutoff.setMonth(cutoff.getMonth() - 1); break;
  }

  const rows = await db
    .select({ valueWei: safeTransactionHistory.valueWei })
    .from(safeTransactionHistory)
    .where(
      and(
        eq(safeTransactionHistory.safeId, safeId),
        gte(safeTransactionHistory.executedAt, cutoff)
      )
    );

  let total = BigInt(0);
  for (const r of rows) {
    try {
      total += BigInt(r.valueWei);
    } catch {
      // skip malformed values
    }
  }
  return total;
}

/** Count transactions since a given date. */
export async function getTransactionCountSince(
  safeId: string,
  since: Date
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(safeTransactionHistory)
    .where(
      and(
        eq(safeTransactionHistory.safeId, safeId),
        gte(safeTransactionHistory.executedAt, since)
      )
    );
  return rows[0]?.count ?? 0;
}
