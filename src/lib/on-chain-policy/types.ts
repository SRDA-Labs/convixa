/**
 * Shared types for on-chain policy (used by deploy-with-wallet and dashboard client).
 */
export type OnChainPolicyConfig = {
  safeId: string;
  safeAddress: string;
  safeName: string | null;
  network: string;
  policyOwnerType: "safe" | "eoa";
  policyOwnerAddress: string;
  modules: {
    blocklist?: { addresses: string[] };
    sanctions?: { enabled: boolean; oracleAddress?: string };
    maxValue?: { maxWei: string };
    timeWindow?: { startUtc: string; endUtc: string };
    allowlist?: { addresses: string[] };
  };
};
