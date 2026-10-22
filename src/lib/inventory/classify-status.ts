import type { InventoryTxStatus } from "./types";

function parseNonce(n: number | string | null | undefined): number | null {
  if (n === undefined || n === null || n === "") return null;
  const v = typeof n === "string" ? parseInt(n, 10) : n;
  return Number.isFinite(v) ? v : null;
}

/**
 * Derive inventory feed status from Safe Transaction Service fields.
 * Cancelled = not executed and nonce already advanced past this tx (superseded).
 */
export function classifyInventoryTxStatus(
  tx: {
    isExecuted?: boolean;
    transactionHash?: string | null;
    executionDate?: string | null;
    executedAt?: string | null;
    nonce?: number | string | null;
  },
  safeNonce: number
): InventoryTxStatus {
  if (
    tx.isExecuted === true ||
    Boolean(tx.transactionHash) ||
    Boolean(tx.executionDate) ||
    Boolean(tx.executedAt)
  ) {
    return "executed";
  }
  const txNonce = parseNonce(tx.nonce);
  if (txNonce != null && txNonce < safeNonce) return "cancelled";
  return "proposed";
}
