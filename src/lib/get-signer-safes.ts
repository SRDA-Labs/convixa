/**
 * Server-side helper: fetch all multisigs where the given address is a signer (across supported chains).
 * Uses the MultisigProvider abstraction so it works with any multisig implementation.
 *
 * Used by /api/wallet/safes and /api/wallet/discovered-safes.
 */

import { getAddress } from "viem";
import { SAFE_CHAINS } from "@/lib/safe-api";
import { getProviderFor } from "@/lib/multisig-provider";

const CHAIN_REQUEST_DELAY_MS = 900;
const RATE_LIMIT_RETRY_DELAY_MS = 2500;
const CACHE_TTL_MS = 90_000;

const cache = new Map<string, { data: SignerSafeItem[]; ts: number }>();

function getCached(address: string): SignerSafeItem[] | null {
  const entry = cache.get(address.toLowerCase());
  if (!entry || Date.now() - entry.ts > CACHE_TTL_MS) return null;
  return entry.data;
}

function setCache(address: string, data: SignerSafeItem[]) {
  cache.set(address.toLowerCase(), { data, ts: Date.now() });
  if (cache.size > 200) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

function toChecksumAddress(addr: string): string {
  try {
    return getAddress(addr);
  } catch {
    return addr;
  }
}

export interface SignerSafeItem {
  address: string;
  network: string;
  chainId: number;
  chainName?: string;
  threshold: number;
  owners: string[];
  /** Implementation type (default "safe" for now). */
  implementation?: string;
}

export async function getSignerSafesForAddress(
  ownerAddress: string,
  options?: { nocache?: boolean }
): Promise<SignerSafeItem[]> {
  const addr = getAddress(ownerAddress);
  if (!options?.nocache) {
    const cached = getCached(addr);
    if (cached) return cached;
  }

  const results: SignerSafeItem[] = [];
  const provider = getProviderFor("safe", "eth"); // Safe provider works on all chains

  for (let i = 0; i < SAFE_CHAINS.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, CHAIN_REQUEST_DELAY_MS));
    const chain = SAFE_CHAINS[i];

    // Discover Safe addresses via provider
    let safeAddresses: string[] = [];
    try {
      safeAddresses = await provider.discoverBySigner(chain.slug, addr);
    } catch {
      // Retry once after rate limit delay
      await new Promise((r) => setTimeout(r, RATE_LIMIT_RETRY_DELAY_MS));
      try {
        safeAddresses = await provider.discoverBySigner(chain.slug, addr);
      } catch {
        // skip chain
      }
    }

    for (const address of safeAddresses) {
      const safeAddr = toChecksumAddress(address);

      // Fetch account details via provider
      try {
        const account = await provider.fetchAccount(chain.slug, safeAddr);
        if (account && account.signers.length > 0) {
          results.push({
            address: account.address,
            network: chain.slug,
            chainId: chain.chainId,
            chainName: chain.name,
            threshold: account.threshold,
            owners: account.signers,
            implementation: account.implementation,
          });
        } else {
          results.push({
            address: safeAddr,
            network: chain.slug,
            chainId: chain.chainId,
            chainName: chain.name,
            threshold: 0,
            owners: [],
            implementation: "safe",
          });
        }
      } catch {
        results.push({
          address: safeAddr,
          network: chain.slug,
          chainId: chain.chainId,
          chainName: chain.name,
          threshold: 0,
          owners: [],
          implementation: "safe",
        });
      }
    }
  }

  setCache(addr, results);
  return results;
}
