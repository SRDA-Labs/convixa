/**
 * Signer Queue Aggregator
 *
 * Fetches pending transactions across all of a user's linked wallets
 * and aggregates them into a unified "My Queue" view.
 */

import { getCurrentUserOrgs } from "@/lib/auth-server";
import { getAddress } from "viem";
import {
  SAFE_CHAINS,
  safeApiFetch,
  getSafeTxServiceBaseUrl,
  getSafeAppUrl,
  inferTxCategory,
  inferTxType,
} from "@/lib/safe-api";
import { discoverSignerSafesForWallet } from "@/lib/signer-queue/discover-safes";
import {
  injectDevSimulatedIntoQueue,
  isDevSimulateEnabled,
} from "@/lib/signer-queue/dev-simulate";
import { getLinkedWalletsForUser } from "@/lib/signer-queue/linked-wallets";

export interface PendingTx {
  safeTxHash: string;
  to: string;
  value: string;
  /** Human-readable label for UI */
  type: string;
  /** Canonical Safe tx type for checklist matching */
  txCategory: string;
  nonce: number;
  confirmations: number;
  confirmationsRequired: number;
  submissionDate: string;
  safeAppUrl: string;
  isWaitingOnMe: boolean;
}

export interface QueueSafe {
  safeId: string | null;
  safeAddress: string;
  safeName: string | null;
  network: string;
  chainName: string;
  threshold: number;
  ownersCount: number;
  pendingTransactions: PendingTx[];
  pendingCount: number;
  needsMySignatureCount: number;
}

export interface QueueOrg {
  orgId: string;
  orgName: string;
  safes: QueueSafe[];
  pendingCount: number;
}

export interface QueueWallet {
  address: string;
  label: string | null;
  isPrimary: boolean;
  orgs: QueueOrg[];
  pendingCount: number;
}

export interface SignerQueueResponse {
  /** Pending txs waiting on the linked wallet's signature */
  totalPending: number;
  /** Pending txs on signer safes where this wallet already signed (awaiting co-signers) */
  awaitingCoSigners: number;
  wallets: QueueWallet[];
}

/**
 * Fetch pending transactions from the Safe Transaction Service for a specific Safe.
 */
async function fetchPendingTxs(
  network: string,
  safeAddress: string,
  signerAddress: string
): Promise<PendingTx[]> {
  let checksummed: string;
  try {
    checksummed = getAddress(safeAddress);
  } catch {
    return [];
  }

  const baseUrl = getSafeTxServiceBaseUrl(network);
  const url = `${baseUrl}api/v1/safes/${checksummed}/multisig-transactions/?executed=false&limit=50`;

  let res = await safeApiFetch(url, { cache: "no-store" });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 2000));
    res = await safeApiFetch(url, { cache: "no-store" });
  }

  if (!res.ok) return [];

  try {
    const data = (await res.json()) as {
      results?: Array<{
        safeTxHash?: string;
        to?: string;
        value?: string;
        nonce?: number | string;
        confirmations?: Array<{ owner?: string }>;
        confirmationsRequired?: number;
        submissionDate?: string;
        dataDecoded?: { method?: string };
        data?: string;
        operation?: number | string;
      }>;
    };

    const appUrl = getSafeAppUrl(network, checksummed);
    const signerLower = signerAddress.toLowerCase();

    // Scan all non-executed pending txs (any nonce); caller filters to unsigned.
    const results = (data.results ?? []).slice().sort((a, b) => {
      const na =
        typeof a.nonce === "string" ? parseInt(a.nonce, 10) : (a.nonce ?? 0);
      const nb =
        typeof b.nonce === "string" ? parseInt(b.nonce, 10) : (b.nonce ?? 0);
      return na - nb;
    });

    return results.map((tx) => {
      const confirmations = tx.confirmations ?? [];
      const hasConfirmed = confirmations.some(
        (c) => c.owner?.toLowerCase() === signerLower
      );

      const txNonce =
        typeof tx.nonce === "string" ? parseInt(tx.nonce, 10) : (tx.nonce ?? 0);

      return {
        safeTxHash: tx.safeTxHash ?? "",
        to: tx.to ?? "",
        value: tx.value ?? "0",
        type: inferTxType(
          tx.dataDecoded?.method,
          tx.value ?? "0",
          tx.data ?? "0x",
          tx.operation
        ),
        txCategory: inferTxCategory(
          tx.dataDecoded?.method,
          tx.value ?? "0",
          tx.data ?? "0x",
          tx.operation
        ),
        nonce: txNonce,
        confirmations: confirmations.length,
        confirmationsRequired: tx.confirmationsRequired ?? 0,
        submissionDate: tx.submissionDate ?? new Date().toISOString(),
        safeAppUrl: appUrl,
        isWaitingOnMe: !hasConfirmed,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Build the full signer queue for a user — aggregate pending
 * transactions across all linked wallets.
 */
export async function buildSignerQueue(
  userId: string
): Promise<SignerQueueResponse> {
  const walletLinks = await getLinkedWalletsForUser(userId);
  if (walletLinks.length === 0) {
    return { totalPending: 0, awaitingCoSigners: 0, wallets: [] };
  }

  const memberships = await getCurrentUserOrgs();
  const orgIds = memberships.map((m) => m.orgId);

  const wallets: QueueWallet[] = [];
  let totalPending = 0;
  let awaitingCoSigners = 0;

  for (const link of walletLinks) {
    const checksummed = link.address;
    const signerSafes = await discoverSignerSafesForWallet(checksummed, orgIds);

    // Group safes by org (discovered-only safes share a synthetic bucket)
    const orgMap = new Map<string, QueueOrg>();

    for (const s of signerSafes) {
      const orgId = s.orgId ?? "discovered";
      const orgName = s.orgName ?? "Discovered";
      if (!orgMap.has(orgId)) {
        orgMap.set(orgId, { orgId, orgName, safes: [], pendingCount: 0 });
      }
      const org = orgMap.get(orgId)!;

      const pendingTxs = await fetchPendingTxs(s.network, s.safeAddress, checksummed);
      const needsMine = pendingTxs.filter((tx) => tx.isWaitingOnMe);
      const alreadySigned = pendingTxs.filter((tx) => !tx.isWaitingOnMe);
      awaitingCoSigners += alreadySigned.length;

      if (needsMine.length === 0) continue;

      const safeEntry: QueueSafe = {
        safeId: s.safeId,
        safeAddress: s.safeAddress,
        safeName: s.safeName,
        network: s.network,
        chainName: SAFE_CHAINS.find((c) => c.slug === s.network)?.name ?? s.network,
        threshold: s.threshold,
        ownersCount: s.ownersCount,
        pendingTransactions: needsMine,
        pendingCount: needsMine.length,
        needsMySignatureCount: needsMine.length,
      };

      org.safes.push(safeEntry);
      org.pendingCount += needsMine.length;
      totalPending += needsMine.length;
    }

    wallets.push({
      address: checksummed,
      label: link.label,
      isPrimary: link.isPrimary,
      orgs: Array.from(orgMap.values()).filter((o) => o.pendingCount > 0),
      pendingCount: Array.from(orgMap.values()).reduce((sum, o) => sum + o.pendingCount, 0),
    });
  }

  let result: SignerQueueResponse = { totalPending, awaitingCoSigners, wallets };

  if (isDevSimulateEnabled() && walletLinks.length > 0) {
    const primary = walletLinks.find((w) => w.isPrimary) ?? walletLinks[0];
    const signerSafes = await discoverSignerSafesForWallet(primary.address, orgIds);
    const target =
      signerSafes.find((s) => s.safeId && s.inInventory) ??
      signerSafes.find((s) => s.safeId) ??
      signerSafes[0];
    if (target) {
      result = injectDevSimulatedIntoQueue(result, primary.address, target);
    }
  }

  return result;
}
