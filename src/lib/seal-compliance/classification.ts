import type { SafeClassification } from "./types";

const HIGH_VALUE_USD = 1_000_000;
const MEDIUM_VALUE_USD = 100_000;

export function getEthUsdEstimate(): number {
  const raw = process.env.ETH_USD_ESTIMATE;
  const n = raw ? parseFloat(raw) : 3000;
  return Number.isFinite(n) && n > 0 ? n : 3000;
}

/** Estimate USD from native ETH balance string (wei). */
export function estimateUsdFromEthWei(balanceWei: string | bigint): number {
  try {
    const wei = typeof balanceWei === "string" ? BigInt(balanceWei) : balanceWei;
    const eth = Number(wei) / 1e18;
    return eth * getEthUsdEstimate();
  } catch {
    return 0;
  }
}

/** Sum native ETH from snapshot balances JSON. */
export function estimateUsdFromSnapshotBalances(balances: unknown): number {
  if (!Array.isArray(balances)) return 0;
  let totalWei = BigInt(0);
  for (const b of balances) {
    const row = b as { tokenAddress?: string | null; balance?: string };
    if (row.tokenAddress == null && row.balance) {
      try {
        totalWei += BigInt(row.balance);
      } catch {
        // skip
      }
    }
  }
  return estimateUsdFromEthWei(totalWei);
}

export function inferClassificationFromUsd(
  usd: number,
  explicit: SafeClassification
): SafeClassification {
  if (explicit) return explicit;
  if (usd >= HIGH_VALUE_USD) return "treasury";
  if (usd >= MEDIUM_VALUE_USD) return "operational";
  return "personal";
}

export function getRecommendedConfig(
  classification: SafeClassification,
  estimatedUsd: number
): { owners: number; threshold: number } {
  if (classification === "protocol_critical" || estimatedUsd >= HIGH_VALUE_USD) {
    return { owners: 7, threshold: 4 };
  }
  if (classification === "treasury" || estimatedUsd >= MEDIUM_VALUE_USD) {
    return { owners: 5, threshold: 3 };
  }
  return { owners: 3, threshold: 2 };
}
