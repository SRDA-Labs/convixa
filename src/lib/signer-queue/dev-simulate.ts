/**
 * Dev-only simulated pending tx for testing Signer Queue checklist + Security tabs.
 * Enable with SIGNER_QUEUE_DEV_SIMULATE=true (never in production).
 */

import { SAFE_CHAINS, getSafeAppUrl } from "@/lib/safe-api";
import type { PendingTx, QueueSafe, QueueWallet, SignerQueueResponse } from "./aggregator";
import type { DiscoveredSignerSafe } from "./discover-safes";
import { DEV_SIMULATED_SAFE_TX_HASH } from "./simulated-tx";

export { DEV_SIMULATED_SAFE_TX_HASH };

export function isDevSimulateEnabled(): boolean {
  return (
    process.env.SIGNER_QUEUE_DEV_SIMULATE === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

export function buildSimulatedPendingTx(
  network: string,
  safeAddress: string,
  threshold: number
): PendingTx & { isSimulated: true } {
  return {
    safeTxHash: DEV_SIMULATED_SAFE_TX_HASH,
    to: "0x544Bb3E325E8139237518B3882b5899399b2A683",
    value: "100000000000000000",
    type: "Native transfer",
    txCategory: "NATIVE_TRANSFER",
    nonce: 99999,
    confirmations: 0,
    confirmationsRequired: threshold,
    submissionDate: new Date().toISOString(),
    safeAppUrl: getSafeAppUrl(network, safeAddress),
    isWaitingOnMe: true,
    isSimulated: true,
  };
}

export function injectDevSimulatedIntoQueue(
  response: SignerQueueResponse,
  walletAddress: string,
  targetSafe: DiscoveredSignerSafe
): SignerQueueResponse {
  if (!isDevSimulateEnabled() || !targetSafe.safeId) return response;

  const simulated = buildSimulatedPendingTx(
    targetSafe.network,
    targetSafe.safeAddress,
    targetSafe.threshold
  );

  let wallet = response.wallets.find(
    (w) => w.address.toLowerCase() === walletAddress.toLowerCase()
  );
  if (!wallet) {
    wallet = {
      address: walletAddress,
      label: null,
      isPrimary: true,
      orgs: [],
      pendingCount: 0,
    };
    response.wallets.push(wallet);
  }

  const orgId = targetSafe.orgId ?? "discovered";
  let org = wallet.orgs.find((o) => o.orgId === orgId);
  if (!org) {
    org = {
      orgId,
      orgName: targetSafe.orgName ?? "Org",
      safes: [],
      pendingCount: 0,
    };
    wallet.orgs.push(org);
  }

  const alreadyPresent = org.safes.some((s) =>
    s.pendingTransactions.some((t) => t.safeTxHash === DEV_SIMULATED_SAFE_TX_HASH)
  );
  if (alreadyPresent) return response;

  const safeEntry: QueueSafe = {
    safeId: targetSafe.safeId,
    safeAddress: targetSafe.safeAddress,
    safeName: targetSafe.safeName,
    network: targetSafe.network,
    chainName:
      SAFE_CHAINS.find((c) => c.slug === targetSafe.network)?.name ?? targetSafe.network,
    threshold: targetSafe.threshold,
    ownersCount: targetSafe.ownersCount,
    pendingTransactions: [simulated],
    pendingCount: 1,
    needsMySignatureCount: 1,
  };

  org.safes.unshift(safeEntry);
  org.pendingCount += 1;
  wallet.pendingCount += 1;

  return {
    ...response,
    totalPending: response.totalPending + 1,
  };
}
