import {
  fetchSafePendingTransactions,
  inferTxCategory,
  inferTxType,
} from "@/lib/safe-api";
import type { TxSnapshot } from "@/lib/db/schema/operational-workflows.schema";
import { normalizeSafeTxHash } from "@/lib/db/repositories/operational-workflows.repository";

type RawSafeTx = {
  safeTxHash?: string;
  to?: string;
  value?: string;
  nonce?: number | string;
  confirmations?: Array<{ owner?: string }>;
  confirmationsRequired?: number;
  submissionDate?: string;
  executed?: boolean;
  dataDecoded?: { method?: string };
  data?: string;
  operation?: number | string;
};

function parseNonce(nonce: number | string | undefined): number {
  if (nonce === undefined) return 0;
  return typeof nonce === "string" ? parseInt(nonce, 10) : nonce;
}

export function buildTxSnapshotFromRaw(tx: RawSafeTx): TxSnapshot | null {
  const hash = tx.safeTxHash?.trim();
  if (!hash) return null;

  const value = tx.value ?? "0";
  const data = tx.data ?? "0x";
  const method = tx.dataDecoded?.method;

  return {
    safeTxHash: normalizeSafeTxHash(hash),
    to: tx.to ?? "",
    value,
    txType: inferTxType(method, value, data, tx.operation),
    txCategory: inferTxCategory(method, value, data, tx.operation),
    nonce: parseNonce(tx.nonce),
    confirmations: tx.confirmations?.length ?? 0,
    confirmationsRequired: tx.confirmationsRequired ?? 0,
    submissionDate: tx.submissionDate ?? new Date().toISOString(),
    executed: tx.executed ?? false,
  };
}

/** Fetch a specific pending tx from Safe API and build a durable snapshot. */
export async function fetchTxSnapshotForHash(
  network: string,
  safeAddress: string,
  safeTxHash: string
): Promise<TxSnapshot | null> {
  const normalized = normalizeSafeTxHash(safeTxHash);
  const pending = await fetchSafePendingTransactions(network, safeAddress);

  const match = pending.find(
    (tx) => normalizeSafeTxHash(String(tx.safeTxHash ?? "")) === normalized
  );
  if (match) {
    return buildTxSnapshotFromRaw(match as RawSafeTx);
  }

  return null;
}

/** Used by lifecycle: returns snapshot if still pending, or marks as gone from queue. */
export async function fetchTxSnapshotOrExecuted(
  network: string,
  safeAddress: string,
  safeTxHash: string
): Promise<{ snapshot: TxSnapshot; executed: boolean } | null> {
  const snapshot = await fetchTxSnapshotForHash(network, safeAddress, safeTxHash);
  if (snapshot) {
    return { snapshot, executed: false };
  }

  const normalized = normalizeSafeTxHash(safeTxHash);
  return {
    executed: true,
    snapshot: {
      safeTxHash: normalized,
      to: "",
      value: "0",
      txType: "Unknown",
      txCategory: "UNKNOWN",
      nonce: 0,
      confirmations: 0,
      confirmationsRequired: 0,
      submissionDate: new Date().toISOString(),
      executed: true,
    },
  };
}
