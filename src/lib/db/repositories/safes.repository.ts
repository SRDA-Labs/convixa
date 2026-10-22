/**
 * Safes Repository
 * 
 * Handles all database operations for Safes and Safe Snapshots.
 */

import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { db } from "../index";
import { safes, safeSnapshots, teams } from "../schema";
import { parseCount, firstOrNull } from "../utils/queries";
import type { DbResult } from "../types";

/**
 * Create a new Safe
 */
export async function createSafe(data: {
  orgId: string;
  teamId: string;
  address: string;
  network: string;
  name?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  implementation?: string | null;
}) {
  const [safe] = await db
    .insert(safes)
    .values({
      orgId: data.orgId,
      teamId: data.teamId,
      address: data.address.toLowerCase(),
      network: data.network,
      name: data.name ?? null,
      tags: data.tags ?? null,
      notes: data.notes ?? null,
      implementation: data.implementation ?? "safe",
    })
    .returning();

  return firstOrNull([safe]);
}

/**
 * Get a Safe by ID
 */
export async function getSafeById(safeId: string): Promise<DbResult<typeof safes.$inferSelect>> {
  const results = await db.select().from(safes).where(eq(safes.id, safeId)).limit(1);
  return firstOrNull(results);
}

/**
 * Get a Safe by address and network
 */
export async function getSafeByAddress(
  orgId: string,
  address: string,
  network: string
): Promise<DbResult<typeof safes.$inferSelect>> {
  const results = await db
    .select()
    .from(safes)
    .where(
      and(
        eq(safes.orgId, orgId),
        eq(safes.address, address.toLowerCase()),
        eq(safes.network, network)
      )
    )
    .limit(1);
  return firstOrNull(results);
}

/**
 * Get all Safes for specific teams
 */
export async function getSafesByTeams(teamIds: string[]) {
  if (teamIds.length === 0) return [];

  return await db
    .select({
      id: safes.id,
      address: safes.address,
      network: safes.network,
      name: safes.name,
      tags: safes.tags,
      notes: safes.notes,
      teamId: safes.teamId,
      teamName: teams.name,
      createdAt: safes.createdAt,
      threshold: safeSnapshots.threshold,
      owners: safeSnapshots.owners,
      pendingCount: safeSnapshots.pendingCount,
      lastTxAt: safeSnapshots.lastTxAt,
      refreshedAt: safeSnapshots.refreshedAt,
    })
    .from(safes)
    .leftJoin(safeSnapshots, eq(safes.id, safeSnapshots.safeId))
    .innerJoin(teams, eq(safes.teamId, teams.id))
    .where(inArray(safes.teamId, teamIds))
    .orderBy(desc(safes.createdAt));
}

/**
 * Get all Safes for an organization
 */
export async function getSafesByOrg(orgId: string) {
  return await db
    .select()
    .from(safes)
    .where(eq(safes.orgId, orgId))
    .orderBy(desc(safes.createdAt));
}

/**
 * Count Safes in an organization.
 */
export async function countSafesByOrg(orgId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(safes)
    .where(eq(safes.orgId, orgId));
  return parseCount(result);
}

/**
 * Update a Safe
 */
export async function updateSafe(
  safeId: string,
  data: {
    name?: string | null;
    tags?: string[] | null;
    notes?: string | null;
  }
) {
  const [updated] = await db
    .update(safes)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(safes.id, safeId))
    .returning();

  return firstOrNull([updated]);
}

/**
 * Delete a Safe
 */
export async function deleteSafe(safeId: string): Promise<boolean> {
  try {
    await db.delete(safes).where(eq(safes.id, safeId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Create or update a Safe snapshot
 */
export async function upsertSafeSnapshot(data: {
  safeId: string;
  threshold?: number | null;
  owners?: string[] | null;
  nonce?: number | null;
  balances?: any | null;
  pendingCount?: number;
  lastTxAt?: Date | null;
  implementationVersion?: string | null;
  rawResponse?: any | null;
}) {
  const [snapshot] = await db
    .insert(safeSnapshots)
    .values({
      safeId: data.safeId,
      threshold: data.threshold ?? null,
      owners: data.owners ?? null,
      nonce: data.nonce ?? null,
      balances: data.balances ?? null,
      pendingCount: data.pendingCount ?? 0,
      lastTxAt: data.lastTxAt ?? null,
      implementationVersion: data.implementationVersion ?? null,
      rawResponse: data.rawResponse ?? null,
      refreshedAt: new Date(),
    })
    .returning();

  return firstOrNull([snapshot]);
}

/**
 * Get the latest snapshot for a Safe
 */
export async function getLatestSnapshot(safeId: string) {
  const results = await db
    .select()
    .from(safeSnapshots)
    .where(eq(safeSnapshots.safeId, safeId))
    .orderBy(desc(safeSnapshots.refreshedAt))
    .limit(1);

  return firstOrNull(results);
}

/**
 * Check if Safe exists in organization
 */
export async function safeExistsInOrg(
  orgId: string,
  address: string,
  network: string
): Promise<boolean> {
  const results = await db
    .select({ id: safes.id })
    .from(safes)
    .where(
      and(
        eq(safes.orgId, orgId),
        eq(safes.address, address.toLowerCase()),
        eq(safes.network, network)
      )
    )
    .limit(1);

  return results.length > 0;
}
