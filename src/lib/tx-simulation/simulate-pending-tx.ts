import { simulateWithTenderly } from "./tenderly-client";
import { extractRiskFlags } from "./risk-flags";
import {
  getSimulationCache,
  upsertSimulationCache,
} from "@/lib/db/repositories/governance.repository";
import { getSimulationCacheTtlHours, isTxSimulationEnabled } from "@/lib/governance-delay/config";

export async function simulatePendingTx(params: {
  orgId: string;
  safeId: string;
  network: string;
  safeAddress: string;
  safeTxHash: string;
  to: string;
  data?: string;
  value?: string;
  blockNumber?: number | null;
  force?: boolean;
}) {
  if (!isTxSimulationEnabled()) {
    return {
      cached: false,
      status: "skipped" as const,
      riskFlags: [{ severity: "info" as const, message: "TX simulation disabled" }],
      result: null,
    };
  }

  if (!params.force) {
    const cached = await getSimulationCache(
      params.safeId,
      params.safeTxHash,
      params.blockNumber
    );
    if (cached?.resultJson) {
      const flags = (cached.resultJson.riskFlags as Array<{ severity: string; message: string }>) ?? [];
      return {
        cached: true,
        status: cached.status as "success" | "failed" | "skipped",
        riskFlags: flags,
        result: cached.resultJson,
      };
    }
  }

  const simulation = await simulateWithTenderly({
    network: params.network,
    from: params.safeAddress,
    to: params.to,
    data: params.data,
    value: params.value,
  });

  const riskFlags = extractRiskFlags(simulation);
  const ttlHours = getSimulationCacheTtlHours();
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  const resultJson = {
    balanceChanges: simulation.balanceChanges,
    decodedCall: simulation.decodedCall,
    gasEstimate: simulation.gasEstimate,
    riskFlags,
    provider: "tenderly",
  };

  await upsertSimulationCache({
    orgId: params.orgId,
    safeId: params.safeId,
    safeTxHash: params.safeTxHash,
    network: params.network,
    blockNumber: params.blockNumber ?? null,
    status: simulation.status,
    resultJson,
    expiresAt,
  });

  return {
    cached: false,
    status: simulation.status,
    riskFlags,
    result: resultJson,
  };
}
