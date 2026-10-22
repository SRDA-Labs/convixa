import { eq, inArray, and, isNull, sql } from "drizzle-orm";
import { getAddress } from "viem";
import { db } from "@/lib/db";
import { safes, orgs, safeSnapshots, safeSignerRoster } from "@/lib/db/schema";
import { getSignerSafesForAddress } from "@/lib/get-signer-safes";

export interface DiscoveredSignerSafe {
  safeId: string | null;
  safeAddress: string;
  safeName: string | null;
  network: string;
  orgId: string | null;
  orgName: string | null;
  threshold: number;
  ownersCount: number;
  inInventory: boolean;
}

function inventoryKey(address: string, network: string): string {
  return `${address.toLowerCase()}:${network}`;
}

function parseOwners(owners: unknown): string[] {
  if (!owners) return [];
  if (Array.isArray(owners)) {
    return owners.map((o) => String(o).toLowerCase());
  }
  if (typeof owners === "string") {
    try {
      const parsed = JSON.parse(owners);
      return Array.isArray(parsed) ? parsed.map((o) => String(o).toLowerCase()) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Include org inventory safes where the wallet is an on-chain signer (snapshot owners or roster).
 * Covers safes added manually to inventory before Safe API discovery catches up.
 */
async function getInventorySafesForSignerWallet(
  walletAddress: string,
  orgIds: string[]
): Promise<DiscoveredSignerSafe[]> {
  if (orgIds.length === 0) return [];

  const walletLower = walletAddress.toLowerCase();

  const inventoryRows = await db
    .select({
      safeId: safes.id,
      address: safes.address,
      name: safes.name,
      network: safes.network,
      orgId: safes.orgId,
      orgName: orgs.name,
      threshold: safeSnapshots.threshold,
      owners: safeSnapshots.owners,
    })
    .from(safes)
    .innerJoin(orgs, eq(safes.orgId, orgs.id))
    .leftJoin(safeSnapshots, eq(safes.id, safeSnapshots.safeId))
    .where(inArray(safes.orgId, orgIds));

  const bySafeId = new Map<string, (typeof inventoryRows)[0]>();
  for (const row of inventoryRows) {
    const existing = bySafeId.get(row.safeId);
    if (!existing || (row.threshold != null && existing.threshold == null)) {
      bySafeId.set(row.safeId, row);
    }
  }

  const safeIds = [...bySafeId.keys()];
  const rosterRows =
    safeIds.length > 0
      ? await db
          .select({
            safeId: safeSignerRoster.safeId,
            signerAddress: safeSignerRoster.signerAddress,
          })
          .from(safeSignerRoster)
          .where(
            and(
              inArray(safeSignerRoster.safeId, safeIds),
              isNull(safeSignerRoster.removedAt),
              sql`lower(${safeSignerRoster.signerAddress}) = ${walletLower}`
            )
          )
      : [];

  const rosterSafeIds = new Set(rosterRows.map((r) => r.safeId));
  const results: DiscoveredSignerSafe[] = [];

  for (const row of bySafeId.values()) {
    const owners = parseOwners(row.owners);
    const isSigner = owners.includes(walletLower) || rosterSafeIds.has(row.safeId);
    if (!isSigner) continue;

    try {
      results.push({
        safeId: row.safeId,
        safeAddress: getAddress(row.address),
        safeName: row.name,
        network: row.network,
        orgId: row.orgId,
        orgName: row.orgName,
        threshold: row.threshold ?? 0,
        ownersCount: owners.length || 1,
        inInventory: true,
      });
    } catch {
      // skip invalid address
    }
  }

  return results;
}

/**
 * Discover multisigs where the wallet is a signer via Safe Transaction Service,
 * optionally enriched with org inventory metadata when the safe is already tracked.
 * Also merges inventory safes where the wallet is a known signer (snapshot/roster).
 */
export async function discoverSignerSafesForWallet(
  walletAddress: string,
  orgIds: string[] = [],
  options?: { nocache?: boolean }
): Promise<DiscoveredSignerSafe[]> {
  const discovered = await getSignerSafesForAddress(walletAddress, options);

  const inventoryByKey = new Map<
    string,
    { safeId: string; safeName: string | null; orgId: string; orgName: string }
  >();

  if (orgIds.length > 0) {
    const inventoryRows = await db
      .select({
        id: safes.id,
        address: safes.address,
        name: safes.name,
        network: safes.network,
        orgId: safes.orgId,
        orgName: orgs.name,
      })
      .from(safes)
      .innerJoin(orgs, eq(safes.orgId, orgs.id))
      .where(inArray(safes.orgId, orgIds));

    for (const row of inventoryRows) {
      inventoryByKey.set(inventoryKey(row.address, row.network), {
        safeId: row.id,
        safeName: row.name,
        orgId: row.orgId,
        orgName: row.orgName,
      });
    }
  }

  const seen = new Set<string>();
  const results: DiscoveredSignerSafe[] = [];

  for (const item of discovered) {
    const key = inventoryKey(item.address, item.network);
    if (seen.has(key)) continue;
    seen.add(key);

    const inventory = inventoryByKey.get(key);
    results.push({
      safeId: inventory?.safeId ?? null,
      safeAddress: item.address,
      safeName: inventory?.safeName ?? null,
      network: item.network,
      orgId: inventory?.orgId ?? null,
      orgName: inventory?.orgName ?? null,
      threshold: item.threshold,
      ownersCount: item.owners.length,
      inInventory: !!inventory,
    });
  }

  const inventorySignerSafes = await getInventorySafesForSignerWallet(walletAddress, orgIds);
  for (const safe of inventorySignerSafes) {
    const key = inventoryKey(safe.safeAddress, safe.network);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(safe);
  }

  return results;
}
