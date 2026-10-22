/**
 * EOA activity fetcher (v1) — block explorer API with 7-day outgoing tx heuristic.
 * v1 limitation: cannot distinguish Safe Mobile vs personal transfers with 100% accuracy.
 */

import { getAddress } from "viem";

type ExplorerConfig = { baseUrl: string; apiKeyEnv: string };

const EXPLORER_BY_NETWORK: Record<string, ExplorerConfig> = {
  eth: { baseUrl: "https://api.etherscan.io/api", apiKeyEnv: "ETHERSCAN_API_KEY" },
  sepolia: { baseUrl: "https://api-sepolia.etherscan.io/api", apiKeyEnv: "ETHERSCAN_API_KEY" },
  base: { baseUrl: "https://api.basescan.org/api", apiKeyEnv: "ETHERSCAN_API_KEY" },
  arbitrum: { baseUrl: "https://api.arbiscan.io/api", apiKeyEnv: "ETHERSCAN_API_KEY" },
  polygon: { baseUrl: "https://api.polygonscan.com/api", apiKeyEnv: "ETHERSCAN_API_KEY" },
  optimism: { baseUrl: "https://api-optimistic.etherscan.io/api", apiKeyEnv: "ETHERSCAN_API_KEY" },
  "gnosis-chain": { baseUrl: "https://api.gnosisscan.io/api", apiKeyEnv: "ETHERSCAN_API_KEY" },
  avalanche: { baseUrl: "https://api.snowtrace.io/api", apiKeyEnv: "ETHERSCAN_API_KEY" },
  bsc: { baseUrl: "https://api.bscscan.com/api", apiKeyEnv: "ETHERSCAN_API_KEY" },
};

export type EoaActivityResult = {
  signerAddress: string;
  network: string;
  activityCount7d: number;
  lastOutgoingTxAt: Date | null;
  lastOutgoingTxHash: string | null;
  rawSummary: { txs: Array<{ hash: string; timeStamp: string; to: string }> };
};

function getApiKey(): string | null {
  return process.env.ETHERSCAN_API_KEY ?? null;
}

export function isExplorerSupported(network: string): boolean {
  return network in EXPLORER_BY_NETWORK && Boolean(getApiKey());
}

export async function fetchEoaOutgoingActivity(
  network: string,
  signerAddress: string,
  lookbackDays = 7
): Promise<EoaActivityResult | null> {
  const config = EXPLORER_BY_NETWORK[network];
  const apiKey = getApiKey();
  if (!config || !apiKey) return null;

  let address: string;
  try {
    address = getAddress(signerAddress);
  } catch {
    return null;
  }

  const url = new URL(config.baseUrl);
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "txlist");
  url.searchParams.set("address", address);
  url.searchParams.set("startblock", "0");
  url.searchParams.set("endblock", "99999999");
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", "50");
  url.searchParams.set("sort", "desc");
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    status?: string;
    result?: Array<{ hash: string; timeStamp: string; from: string; to: string; isError?: string }>;
  };

  if (data.status !== "1" || !Array.isArray(data.result)) {
    return {
      signerAddress: address,
      network,
      activityCount7d: 0,
      lastOutgoingTxAt: null,
      lastOutgoingTxHash: null,
      rawSummary: { txs: [] },
    };
  }

  const cutoff = Math.floor(Date.now() / 1000) - lookbackDays * 86400;
  const addrLower = address.toLowerCase();

  const outgoing = data.result.filter(
    (tx) =>
      tx.from?.toLowerCase() === addrLower &&
      tx.isError !== "1" &&
      parseInt(tx.timeStamp, 10) >= cutoff
  );

  const txs = outgoing.map((tx) => ({
    hash: tx.hash,
    timeStamp: tx.timeStamp,
    to: tx.to,
  }));

  const latest = outgoing[0];

  return {
    signerAddress: address,
    network,
    activityCount7d: outgoing.length,
    lastOutgoingTxAt: latest ? new Date(parseInt(latest.timeStamp, 10) * 1000) : null,
    lastOutgoingTxHash: latest?.hash ?? null,
    rawSummary: { txs },
  };
}

export async function pollOrgEoaActivity(
  orgId: string,
  addresses: Array<{ signerAddress: string; network: string }>,
  lookbackDays = 7
): Promise<{ checked: number; errors: string[] }> {
  const { upsertEoaActivity } = await import("@/lib/db/repositories/safe-signer-roster.repository");
  const errors: string[] = [];
  let checked = 0;

  for (const { signerAddress, network } of addresses) {
    if (!isExplorerSupported(network)) continue;
    try {
      const result = await fetchEoaOutgoingActivity(network, signerAddress, lookbackDays);
      if (!result) continue;
      await upsertEoaActivity({
        orgId,
        signerAddress: result.signerAddress,
        network: result.network,
        lastCheckedAt: new Date(),
        lastOutgoingTxAt: result.lastOutgoingTxAt,
        lastOutgoingTxHash: result.lastOutgoingTxHash,
        activityCount7d: result.activityCount7d,
        rawSummary: result.rawSummary,
      });
      checked++;
      await new Promise((r) => setTimeout(r, 250));
    } catch (e) {
      errors.push(
        `${signerAddress}@${network}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  return { checked, errors };
}
