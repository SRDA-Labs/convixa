import { getAddress } from "viem";
import {
  fetchSafeInfo,
  getSafeTxServiceBaseUrl,
  inferTxType,
  safeApiFetch,
} from "@/lib/safe-api";
import type {
  AggregateInventoryTransactionsResult,
  InventoryTxCursor,
  InventoryTxRow,
  InventoryTxStatusFilter,
} from "./types";
import { classifyInventoryTxStatus } from "./classify-status";

export { classifyInventoryTxStatus } from "./classify-status";

export const MAX_SAFES_FOR_TX_FEED = 25;
export const DEFAULT_PER_SAFE_LIMIT = 10;
export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 100;
/** Delay between Safes to stay under Safe API rate limits. */
const STAGGER_MS = 350;
/** Small gap between calls for the same Safe. */
const INTRA_SAFE_GAP_MS = 120;

type MultisigTxRaw = {
  safeTxHash?: string;
  transactionHash?: string | null;
  to?: string;
  value?: string;
  data?: string | null;
  nonce?: number | string;
  submissionDate?: string;
  executedAt?: string | null;
  executionDate?: string | null;
  isExecuted?: boolean;
  dataDecoded?: { method?: string } | null;
};

export type SafeForTxAggregate = {
  id: string;
  address: string;
  network: string;
  name: string | null;
};

function parseNonce(n: number | string | null | undefined): number | null {
  if (n === undefined || n === null || n === "") return null;
  const v = typeof n === "string" ? parseInt(n, 10) : n;
  return Number.isFinite(v) ? v : null;
}

function parseList(raw: unknown): MultisigTxRaw[] {
  if (Array.isArray(raw)) return raw as MultisigTxRaw[];
  if (raw && typeof raw === "object" && "results" in raw) {
    return (raw as { results?: MultisigTxRaw[] }).results ?? [];
  }
  return [];
}

function isExecutedRow(tx: MultisigTxRaw): boolean {
  if (tx.isExecuted === true) return true;
  if (tx.transactionHash) return true;
  if (tx.executionDate || tx.executedAt) return true;
  return false;
}

function mapRawToRow(
  tx: MultisigTxRaw,
  safe: SafeForTxAggregate,
  safeNonce: number,
  forceExecuted: boolean
): InventoryTxRow | null {
  const safeTxHash = tx.safeTxHash?.trim();
  if (!safeTxHash) return null;

  const value = tx.value ?? "0";
  const dataPayload = tx.data ?? "";
  const method = tx.dataDecoded?.method;
  const executedAt = tx.executedAt ?? tx.executionDate ?? null;
  const submissionDate = tx.submissionDate ?? null;
  const status = forceExecuted
    ? "executed"
    : classifyInventoryTxStatus(
        {
          isExecuted: tx.isExecuted,
          transactionHash: tx.transactionHash,
          executionDate: tx.executionDate,
          executedAt: tx.executedAt,
          nonce: tx.nonce,
        },
        safeNonce
      );

  const sortAt = executedAt || submissionDate || "";
  if (!sortAt) return null;

  return {
    safeId: safe.id,
    safeName: safe.name,
    safeAddress: safe.address,
    network: safe.network,
    safeTxHash,
    transactionHash: tx.transactionHash ?? null,
    status,
    nonce: parseNonce(tx.nonce),
    to: tx.to ?? "",
    value,
    txType: inferTxType(method, value, dataPayload),
    submissionDate,
    executedAt,
    sortAt,
  };
}

async function fetchMultisigList(
  network: string,
  address: string,
  executed: boolean,
  limit: number
): Promise<MultisigTxRaw[]> {
  const base = getSafeTxServiceBaseUrl(network);
  let checksum: string;
  try {
    checksum = getAddress(address);
  } catch {
    checksum = address;
  }
  const url = `${base}api/v1/safes/${checksum}/multisig-transactions/?executed=${executed}&limit=${limit}`;
  let res = await safeApiFetch(url);
  if (!res.ok && res.status === 429) {
    await new Promise((r) => setTimeout(r, 2000));
    res = await safeApiFetch(url);
  }
  if (!res.ok) throw new Error(`Safe API ${res.status}`);
  const raw = await res.json();
  return parseList(raw);
}

async function fetchTxsForSafe(
  safe: SafeForTxAggregate,
  perSafeLimit: number
): Promise<{ rows: InventoryTxRow[]; error: boolean }> {
  let safeNonce = 0;
  try {
    const info = await fetchSafeInfo(safe.network, safe.address);
    safeNonce =
      typeof info?.nonce === "string"
        ? parseInt(info.nonce, 10)
        : (info?.nonce ?? 0);
  } catch {
    // Continue without nonce — pending rows will classify as proposed.
  }

  await new Promise((r) => setTimeout(r, INTRA_SAFE_GAP_MS));

  let executedRaw: MultisigTxRaw[] = [];
  let pendingRaw: MultisigTxRaw[] = [];
  let executedFailed = false;
  let pendingFailed = false;

  try {
    executedRaw = await fetchMultisigList(
      safe.network,
      safe.address,
      true,
      perSafeLimit
    );
  } catch {
    executedFailed = true;
  }

  await new Promise((r) => setTimeout(r, INTRA_SAFE_GAP_MS));

  try {
    pendingRaw = await fetchMultisigList(
      safe.network,
      safe.address,
      false,
      perSafeLimit
    );
  } catch {
    pendingFailed = true;
  }

  if (executedFailed && pendingFailed) {
    return { rows: [], error: true };
  }

  const rows: InventoryTxRow[] = [];
  const seen = new Set<string>();

  for (const tx of executedRaw) {
    const row = mapRawToRow(tx, safe, safeNonce, true);
    if (!row || seen.has(row.safeTxHash)) continue;
    seen.add(row.safeTxHash);
    rows.push(row);
  }

  for (const tx of pendingRaw) {
    if (isExecutedRow(tx)) {
      const row = mapRawToRow(tx, safe, safeNonce, true);
      if (!row || seen.has(row.safeTxHash)) continue;
      seen.add(row.safeTxHash);
      rows.push(row);
      continue;
    }
    const row = mapRawToRow(tx, safe, safeNonce, false);
    if (!row || seen.has(row.safeTxHash)) continue;
    seen.add(row.safeTxHash);
    rows.push(row);
  }

  return { rows, error: executedFailed || pendingFailed };
}

function compareRowsDesc(a: InventoryTxRow, b: InventoryTxRow): number {
  const byDate = b.sortAt.localeCompare(a.sortAt);
  if (byDate !== 0) return byDate;
  return b.safeTxHash.localeCompare(a.safeTxHash);
}

function isAfterCursor(row: InventoryTxRow, cursor: InventoryTxCursor): boolean {
  if (row.sortAt < cursor.sortAt) return true;
  if (row.sortAt === cursor.sortAt && row.safeTxHash < cursor.safeTxHash) return true;
  return false;
}

export function encodeInventoryTxCursor(cursor: InventoryTxCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeInventoryTxCursor(raw: string | null | undefined): InventoryTxCursor | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as InventoryTxCursor;
    if (
      typeof parsed?.sortAt === "string" &&
      typeof parsed?.safeTxHash === "string" &&
      parsed.sortAt &&
      parsed.safeTxHash
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export type AggregateInventoryTransactionsOptions = {
  safes: SafeForTxAggregate[];
  status?: InventoryTxStatusFilter;
  limit?: number;
  cursor?: InventoryTxCursor | null;
  perSafeLimit?: number;
  maxSafes?: number;
};

/**
 * Live-aggregate recent multisig txs across inventory Safes.
 * Soft-fails per Safe; staggers upstream calls to reduce rate-limit pressure.
 */
export async function aggregateInventoryTransactions(
  options: AggregateInventoryTransactionsOptions
): Promise<AggregateInventoryTransactionsResult> {
  const statusFilter: InventoryTxStatusFilter = options.status ?? "all";
  const limit = Math.min(
    Math.max(1, options.limit ?? DEFAULT_PAGE_LIMIT),
    MAX_PAGE_LIMIT
  );
  const perSafeLimit = Math.min(
    Math.max(1, options.perSafeLimit ?? DEFAULT_PER_SAFE_LIMIT),
    50
  );
  const maxSafes = options.maxSafes ?? MAX_SAFES_FOR_TX_FEED;
  const cursor = options.cursor ?? null;

  const totalSafes = options.safes.length;
  const truncated = totalSafes > maxSafes;
  const safesToFetch = options.safes.slice(0, maxSafes);

  const allRows: InventoryTxRow[] = [];
  let partialErrors = 0;

  for (let i = 0; i < safesToFetch.length; i++) {
    const { rows, error } = await fetchTxsForSafe(safesToFetch[i], perSafeLimit);
    if (error) partialErrors += 1;
    allRows.push(...rows);
    if (i < safesToFetch.length - 1) {
      await new Promise((r) => setTimeout(r, STAGGER_MS));
    }
  }

  let filtered = allRows;
  if (statusFilter !== "all") {
    filtered = filtered.filter((r) => r.status === statusFilter);
  }
  if (cursor) {
    filtered = filtered.filter((r) => isAfterCursor(r, cursor));
  }

  filtered.sort(compareRowsDesc);

  const page = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last
      ? { sortAt: last.sortAt, safeTxHash: last.safeTxHash }
      : null;

  return {
    transactions: page,
    nextCursor,
    meta: {
      safeCount: safesToFetch.length,
      totalSafes,
      truncated,
      partialErrors,
    },
  };
}
