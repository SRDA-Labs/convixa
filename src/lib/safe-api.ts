/**
 * Safe Transaction Service API client.
 * Base URLs: https://api.safe.global/tx-service/{chain}/
 * Docs: https://api.safe.global/tx-service/eth/
 */

import { getAddress } from "viem";
import {
  classifySafeTransaction,
  getSafeTxTypeLabel,
} from "@/lib/pre-sign-checklist/tx-types";

/** Default headers for Safe API requests. When SAFE_API_KEY is set, adds Authorization Bearer (401 = invalid key, 429 = rate limit per Safe docs). */
function getSafeApiHeaders(): HeadersInit {
  const base: HeadersInit = {
    Accept: "application/json",
    "User-Agent": "Convixa/1.0 (https://github.com/safe-global/safe-transaction-service)",
  };
  const key = process.env.SAFE_API_KEY;
  if (key?.trim()) {
    return { ...base, Authorization: `Bearer ${key.trim()}` };
  }
  return base;
}

/** Fetch from Safe API with consistent headers. Use in server-side routes only. */
export async function safeApiFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(url, {
    ...init,
    cache: init?.cache ?? "no-store",
    headers: { ...getSafeApiHeaders(), ...init?.headers } as HeadersInit,
  });
}

export const SAFE_CHAINS: { slug: string; name: string; chainId: number }[] = [
  { slug: "eth", name: "Ethereum", chainId: 1 },
  { slug: "base", name: "Base", chainId: 8453 },
  { slug: "arbitrum", name: "Arbitrum One", chainId: 42161 },
  { slug: "polygon", name: "Polygon", chainId: 137 },
  { slug: "optimism", name: "OP Mainnet", chainId: 10 },
  { slug: "gnosis-chain", name: "Gnosis Chain", chainId: 100 },
  { slug: "avalanche", name: "Avalanche", chainId: 43114 },
  { slug: "bsc", name: "BSC", chainId: 56 },
  { slug: "sepolia", name: "Sepolia", chainId: 11155111 },
];

/** Safe hosted tx-service uses these path segments (docs use different names for some chains). */
const SAFE_TX_SERVICE_PATH: Record<string, string> = {
  "gnosis-chain": "gno",
  avalanche: "avax",
  bsc: "bnb",
  sepolia: "sep",
  arbitrum: "arb1",
  optimism: "oeth",
};

/** Chains that use a separate tx-service host (not api.safe.global/tx-service/). */
const SAFE_TX_SERVICE_BASE_URL_OVERRIDE: Record<string, string> = {
  polygon: "https://safe-transaction-polygon.safe.global/",
};

/** Normalize network to our slug (e.g. "ethereum" -> "eth") so Safe API URL is correct. */
function normalizeNetworkSlug(network: string): string {
  const lower = network.trim().toLowerCase();
  const slugMap: Record<string, string> = {
    ethereum: "eth",
    base: "base",
    arbitrum: "arbitrum",
    polygon: "polygon",
    optimism: "optimism",
    gnosis: "gnosis-chain",
    gnosischain: "gnosis-chain",
    avalanche: "avalanche",
    avax: "avalanche",
    bsc: "bsc",
    binance: "bsc",
    sepolia: "sepolia",
  };
  return slugMap[lower] ?? lower;
}

/** Resolve our chain slug to the path segment used by api.safe.global/tx-service/{path}/ */
export function getTxServicePath(ourSlug: string): string {
  const slug = normalizeNetworkSlug(ourSlug);
  return SAFE_TX_SERVICE_PATH[slug] ?? slug;
}

/** Base URL for Safe tx-service (with trailing slash). Polygon uses a separate host. */
export function getSafeTxServiceBaseUrl(network: string): string {
  const slug = normalizeNetworkSlug(network);
  const override = SAFE_TX_SERVICE_BASE_URL_OVERRIDE[slug];
  if (override) return override;
  const path = getTxServicePath(slug);
  return `https://api.safe.global/tx-service/${path}/`;
}

function getBaseUrl(network: string): string {
  return getSafeTxServiceBaseUrl(network);
}

export interface SafeInfo {
  address: string;
  nonce: number;
  threshold: number;
  owners: string[];
  masterCopy?: string;
  version?: string;
  guard?: string | null;
  fallbackHandler?: string | null;
}

export interface SafeModuleEntry {
  address: string;
  name?: string;
}

export interface SafeSecurityAttachments {
  guard: string | null;
  fallbackHandler: string | null;
  modules: SafeModuleEntry[];
}

export interface SafeBalance {
  tokenAddress: string | null;
  token: { symbol: string; name: string; decimals: number } | null;
  balance: string;
}

export interface SafeTransaction {
  safe: string;
  to: string;
  value: string;
  data: string | null;
  operation: number;
  safeTxHash: string;
  nonce?: number | string;
  confirmationsRequired: number;
  confirmations?: { owner: string; signature: string }[];
  executedAt: string | null;
  submissionDate: string;
}

export interface SafeTransactionsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: SafeTransaction[];
}

/** Base URL already ends with /; append path without leading slash. */
function safeApiPath(base: string, path: string): string {
  return base + (path.startsWith("/") ? path.slice(1) : path);
}

/** Fetch all Safe addresses where the given address is an owner/signer (per chain). */
export async function fetchSafesByOwner(
  network: string,
  ownerAddress: string
): Promise<string[]> {
  const base = getBaseUrl(network);
  const url = safeApiPath(base, `api/v1/owners/${toChecksumAddress(ownerAddress)}/safes/`);
  const res = await safeApiFetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as { safes?: string[] } | string[];
  if (Array.isArray(data)) return data;
  return data.safes ?? [];
}

function toChecksumAddress(addr: string): string {
  try {
    return getAddress(addr);
  } catch {
    return addr;
  }
}

export async function fetchSafeInfo(
  network: string,
  address: string
): Promise<SafeInfo | null> {
  const base = getBaseUrl(network);
  const path = `api/v1/safes/${toChecksumAddress(address)}/`;
  const url = safeApiPath(base, path);
  const res = await safeApiFetch(url);
  if (!res.ok) return null;
  let raw: SafeInfo & {
    nonce?: string | number;
    guard?: string | null;
    fallbackHandler?: string | null;
  };
  try {
    raw = (await res.json()) as typeof raw;
  } catch {
    return null;
  }
  if (!raw?.address || !Array.isArray(raw.owners)) return null;
  const data: SafeInfo = {
    ...raw,
    nonce: typeof raw.nonce === "string" ? parseInt(raw.nonce, 10) : (raw.nonce ?? 0),
    guard: raw.guard ?? null,
    fallbackHandler: raw.fallbackHandler ?? null,
  };
  return data;
}

/** Fetch enabled Safe modules for an address. */
export async function fetchSafeModules(
  network: string,
  address: string
): Promise<SafeModuleEntry[]> {
  const base = getBaseUrl(network);
  const url = safeApiPath(base, `api/v1/safes/${toChecksumAddress(address)}/modules/`);
  const res = await safeApiFetch(url);
  if (!res.ok) return [];
  try {
    const data = (await res.json()) as
      | { results?: Array<{ address?: string; name?: string }> }
      | Array<{ address?: string; name?: string }>;
    const list = Array.isArray(data) ? data : (data.results ?? []);
    return list
      .filter((m) => m.address)
      .map((m) => ({
        address: toChecksumAddress(m.address!),
        name: m.name,
      }));
  } catch {
    return [];
  }
}

/** Guard, fallback handler, and enabled modules for a Safe. */
export async function fetchSafeSecurityAttachments(
  network: string,
  address: string
): Promise<SafeSecurityAttachments> {
  const [info, modules] = await Promise.all([
    fetchSafeInfo(network, address),
    fetchSafeModules(network, address),
  ]);
  return {
    guard: info?.guard ?? null,
    fallbackHandler: info?.fallbackHandler ?? null,
    modules,
  };
}

export async function fetchSafeBalances(
  network: string,
  address: string
): Promise<SafeBalance[]> {
  const base = getBaseUrl(network);
  const url = `${base}/api/v1/safes/${toChecksumAddress(address)}/balances/?trusted=false`;
  const res = await safeApiFetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: SafeBalance[] };
  return data.results ?? [];
}

export async function fetchSafePendingTransactions(
  network: string,
  address: string
): Promise<SafeTransaction[]> {
  const base = getBaseUrl(network);
  const path = `api/v1/safes/${toChecksumAddress(address)}/multisig-transactions/?executed=false&limit=100`;
  const url = safeApiPath(base, path);
  const res = await safeApiFetch(url);
  if (!res.ok) return [];
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return [];
  }
  if (Array.isArray(data)) return data as SafeTransaction[];
  if (data && typeof data === "object" && "results" in data) {
    const results = (data as SafeTransactionsResponse).results;
    return Array.isArray(results) ? results : [];
  }
  return [];
}

function getTxNonce(tx: SafeTransaction & { transaction?: { nonce?: number | string } }): number {
  const n = tx.nonce ?? tx.transaction?.nonce;
  if (n === undefined || n === null) return 0;
  return typeof n === "string" ? parseInt(n, 10) : n;
}

/** Live pending count: txs at current nonce when Safe info available, else total queue length. */
export async function getPendingCountLive(network: string, address: string): Promise<number> {
  try {
    const [info, pendingRaw] = await Promise.all([
      fetchSafeInfo(network, address),
      fetchSafePendingTransactions(network, address),
    ]);
    const list = pendingRaw ?? [];
    if (info?.nonce != null) {
      const currentNonce = typeof info.nonce === "string" ? parseInt(info.nonce, 10) : info.nonce;
      const pending = list.filter((tx) => getTxNonce(tx as SafeTransaction & { transaction?: { nonce?: number | string } }) === currentNonce);
      return pending.length;
    }
    return list.length;
  } catch {
    return 0;
  }
}

export async function fetchSafeTransactions(
  network: string,
  address: string,
  limit = 20
): Promise<SafeTransaction[]> {
  const base = getBaseUrl(network);
  const url = `${base}/api/v1/safes/${toChecksumAddress(address)}/multisig-transactions/?executed=true&limit=${limit}`;
  const res = await safeApiFetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as SafeTransactionsResponse;
  return data.results ?? [];
}

export async function fetchSafeData(
  network: string,
  address: string
): Promise<{
  info: SafeInfo | null;
  balances: SafeBalance[];
  pending: SafeTransaction[];
  lastTx: SafeTransaction | null;
}> {
  const [info, balances, pendingRaw, history] = await Promise.all([
    fetchSafeInfo(network, address),
    fetchSafeBalances(network, address),
    fetchSafePendingTransactions(network, address),
    fetchSafeTransactions(network, address, 1),
  ]);

  const currentNonce = info?.nonce ?? 0;
  const pending = (pendingRaw ?? []).filter((tx) => {
    const txNonce = typeof tx.nonce === "string" ? parseInt(tx.nonce, 10) : (tx.nonce ?? 0);
    return txNonce === currentNonce;
  });

  return {
    info,
    balances,
    pending,
    lastTx: history[0] ?? null,
  };
}

export function getSafeAppUrl(network: string, address: string): string {
  const chainMap: Record<string, string> = {
    eth: "eth",
    base: "base",
    arbitrum: "arbitrum",
    polygon: "polygon",
    optimism: "optimism",
    "gnosis-chain": "gno",
    avalanche: "avax",
    bsc: "bnb",
    sepolia: "sep",
  };
  const chain = chainMap[network] ?? network;
  return `https://app.safe.global/home?safe=${chain}:${address}`;
}

/** Infer user-facing transaction type from Safe Transaction Service multisig fields. */
export function inferTxType(
  method: string | undefined,
  value: string,
  data: string,
  operation?: number | string | null
): string {
  const type = classifySafeTransaction({ method, value, data, operation });
  return getSafeTxTypeLabel(type);
}

/** Canonical Convixa type code for checklist template resolution. */
export function inferTxCategory(
  method: string | undefined,
  value: string,
  data: string,
  operation?: number | string | null
): string {
  return classifySafeTransaction({ method, value, data, operation });
}

/** Block explorer transaction URL by network slug (for Etherscan, Basescan, etc.). */
export function getExplorerTxUrl(network: string, txHash: string): string {
  const base: Record<string, string> = {
    eth: "https://etherscan.io/tx",
    base: "https://basescan.org/tx",
    arbitrum: "https://arbiscan.io/tx",
    polygon: "https://polygonscan.com/tx",
    optimism: "https://optimistic.etherscan.io/tx",
    "gnosis-chain": "https://gnosisscan.io/tx",
    avalanche: "https://snowtrace.io/tx",
    bsc: "https://bscscan.com/tx",
    sepolia: "https://sepolia.etherscan.io/tx",
  };
  const root = base[network] ?? "https://etherscan.io/tx";
  return `${root}/${txHash}`;
}
