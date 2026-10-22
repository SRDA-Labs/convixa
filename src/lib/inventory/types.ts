export type InventoryTxStatus = "proposed" | "executed" | "cancelled";

export type InventoryTxRow = {
  safeId: string;
  safeName: string | null;
  safeAddress: string;
  network: string;
  safeTxHash: string;
  transactionHash: string | null;
  status: InventoryTxStatus;
  nonce: number | null;
  to: string;
  value: string;
  txType: string;
  submissionDate: string | null;
  executedAt: string | null;
  /** ISO timestamp used for merge-sort (executedAt ?? submissionDate). */
  sortAt: string;
};

export type InventoryTxCursor = {
  sortAt: string;
  safeTxHash: string;
};

export type InventoryTxStatusFilter = InventoryTxStatus | "all";

export type AggregateInventoryTransactionsResult = {
  transactions: InventoryTxRow[];
  nextCursor: InventoryTxCursor | null;
  meta: {
    safeCount: number;
    totalSafes: number;
    truncated: boolean;
    partialErrors: number;
  };
};
