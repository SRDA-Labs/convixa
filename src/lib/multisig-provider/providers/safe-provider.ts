/**
 * Safe Provider — wraps the existing Safe Transaction Service API client
 * and translates Safe-specific types into wallet-agnostic normalized types.
 *
 * This is the concrete implementation of MultisigProvider for Safe wallets.
 * It delegates to functions in src/lib/safe-api.ts.
 */

import { getAddress } from "viem";
import {
  SAFE_CHAINS,
  fetchSafeInfo,
  fetchSafePendingTransactions,
  fetchSafeBalances,
  fetchSafeTransactions,
  fetchSafesByOwner,
  getSafeAppUrl,
  getExplorerTxUrl as safeGetExplorerTxUrl,
} from "@/lib/safe-api";
import type { SafeInfo, SafeTransaction, SafeBalance } from "@/lib/safe-api";
import type { MultisigProvider } from "../provider-interface";
import type {
  MultisigAccount,
  PendingMultisigTx,
  TokenBalance,
  ProviderCapabilities,
} from "../types";
import { registerProvider } from "../registry";

// ── Helpers ────────────────────────────────────────────────────────

function toChecksum(addr: string): string {
  try {
    return getAddress(addr);
  } catch {
    return addr;
  }
}

function parseNonce(tx: SafeTransaction): number {
  const n = tx.nonce;
  if (n == null) return 0;
  return typeof n === "string" ? parseInt(n, 10) : n;
}

function formatSafeVersion(
  masterCopy: string | undefined,
  version: string | undefined
): string | undefined {
  // masterCopy looks like "0x..." — prefer version if present
  if (version) return version;
  if (!masterCopy) return undefined;
  // Safe 1.4.1 proxy: 0x41675C099F32341bf84BFc5382aF534df5C7461a
  const KNOWN: Record<string, string> = {
    "0x41675c099f32341bf84bfc5382af534df5c7461a": "1.4.1",
    "0x29fcb43b46531bca003ddc8fcb67ffe91900c762": "1.4.1 (L2)",
    "0xd9db270c1b5e3bd161e8c8503c55ceabee709552": "1.3.0",
    "0x3e5c63644e683549055b9be8653de26e0b4cd36e": "1.3.0 (L2)",
    "0x69f4d1788e39c87893c980c06edf4b7f686e2938": "1.1.1",
    "0x76e2cfc1f5fa8f6a5b3fc4c8f4788f0116861f9b": "1.0.0",
  };
  const lowered = masterCopy.toLowerCase();
  return KNOWN[lowered];
}

// ── Translation: Safe API types → Normalized types ─────────────────

function toMultisigAccount(
  safeId: string,
  network: string,
  addr: string,
  info: SafeInfo
): MultisigAccount {
  return {
    safeId,
    address: toChecksum(info.address),
    network,
    implementation: "safe",
    version: formatSafeVersion(info.masterCopy, info.version),
    nonce: info.nonce,
    threshold: info.threshold,
    signers: info.owners.map(toChecksum),
  };
}

function toPendingMultisigTx(
  tx: SafeTransaction
): PendingMultisigTx {
  const confirmations = tx.confirmations ?? [];
  return {
    txHash: tx.safeTxHash,
    to: toChecksum(tx.to),
    value: typeof tx.value === "string" ? tx.value : String(tx.value ?? 0),
    data: tx.data ?? null,
    operation: typeof tx.operation === "number" ? tx.operation : 0,
    confirmations: confirmations.map((c) => toChecksum(c.owner)),
    confirmationsRequired: tx.confirmationsRequired,
    submissionDate: tx.submissionDate,
    proposedBy:
      confirmations.length > 0 ? toChecksum(confirmations[0].owner) : undefined,
    nonce: parseNonce(tx),
  };
}

function toTokenBalance(b: SafeBalance): TokenBalance {
  return {
    tokenAddress: b.tokenAddress ?? null,
    symbol: b.token?.symbol ?? "ETH",
    name: b.token?.name ?? "Ether",
    decimals: b.token?.decimals ?? 18,
    balance: b.balance,
  };
}

// ── Provider Implementation ────────────────────────────────────────

const safeProvider: MultisigProvider = {
  id: "safe",
  name: "Safe (Gnosis Safe)",
  supportedNetworks: SAFE_CHAINS.map((c) => c.slug),
  capabilities: {
    fetchInfo: true,
    fetchPendingTransactions: true,
    fetchBalances: true,
    fetchTransactionHistory: true,
    discoverBySigner: true,
    supportsGuards: true,
    supportsModules: true,
  },

  async fetchAccount(network, address) {
    const info = await fetchSafeInfo(network, address);
    if (!info) return null;
    return toMultisigAccount("", network, address, info);
  },

  async fetchPendingTransactions(network, address) {
    const txs = await fetchSafePendingTransactions(network, address);
    return txs.map(toPendingMultisigTx);
  },

  async fetchBalances(network, address) {
    const balances = await fetchSafeBalances(network, address);
    return balances.map(toTokenBalance);
  },

  async fetchTransactionHistory(network, address, limit = 20) {
    const txs = await fetchSafeTransactions(network, address, limit);
    return txs.map(toPendingMultisigTx);
  },

  async discoverBySigner(network, signerAddress) {
    return fetchSafesByOwner(network, signerAddress);
  },

  getAppUrl(network, address) {
    return getSafeAppUrl(network, address);
  },

  getExplorerTxUrl(network, txHash) {
    return safeGetExplorerTxUrl(network, txHash);
  },
};

// Auto-register at import time
registerProvider(safeProvider);

export { safeProvider };
