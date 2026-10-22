/**
 * Fetch crypto-to-USD rates from CoinGecko (free tier).
 * In-memory cache with TTL to avoid rate limits.
 */

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

const cache = new Map<string, number>();
let cacheFetchedAt = 0;

/** Map our network slug or name to CoinGecko coin id for native token. */
const NETWORK_TO_COINGECKO_ID: Record<string, string> = {
  eth: "ethereum",
  ethereum: "ethereum",
  base: "base",
  arbitrum: "arbitrum-one",
  polygon: "matic-network",
  optimism: "optimism",
  "gnosis-chain": "gnosis",
  gnosis: "gnosis",
  avalanche: "avalanche-2",
  avax: "avalanche-2",
  bsc: "binancecoin",
  binance: "binancecoin",
  sepolia: "ethereum",
};

function normalizeNetwork(network: string): string {
  return network.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Return CoinGecko coin id for the chain's native token (e.g. ETH, MATIC).
 * Used to get USD price for native transfer value.
 */
export function getNativeCoinIdForNetwork(network: string): string {
  const key = normalizeNetwork(network);
  return NETWORK_TO_COINGECKO_ID[key] ?? "ethereum";
}

/**
 * Fetch USD prices for given CoinGecko coin ids. Uses in-memory cache.
 * Returns record of coinId -> usd price. Missing or failed ids are omitted.
 */
export async function getRatesInUsd(coinIds: string[]): Promise<Record<string, number>> {
  const now = Date.now();
  const unique = [...new Set(coinIds)].filter(Boolean);
  if (unique.length === 0) return {};

  const useCache = now - cacheFetchedAt < CACHE_TTL_MS;
  const missing = useCache ? unique.filter((id) => cache.get(id) == null) : unique;

  if (missing.length > 0) {
    try {
      const ids = [...new Set([...missing, "ethereum"])].join(",");
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`;
      const res = await fetch(url, { next: { revalidate: 0 } });
      if (!res.ok) return getFromCache(unique);
      const data = (await res.json()) as Record<string, { usd?: number }>;
      for (const id of unique) {
        const price = data[id]?.usd;
        if (typeof price === "number" && price >= 0) {
          cache.set(id, price);
        }
      }
      if (missing.length > 0) cacheFetchedAt = now;
    } catch {
      // use stale cache or return partial
    }
  }

  return getFromCache(unique);
}

function getFromCache(coinIds: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of coinIds) {
    const v = cache.get(id);
    if (typeof v === "number") out[id] = v;
  }
  return out;
}

/**
 * Get USD price for the native token of a chain (e.g. ETH on Ethereum).
 * Returns price per 1 unit of native token, or 0 if unavailable.
 */
export async function getNativePriceUsd(network: string): Promise<number> {
  const coinId = getNativeCoinIdForNetwork(network);
  const rates = await getRatesInUsd([coinId]);
  return rates[coinId] ?? 0;
}
