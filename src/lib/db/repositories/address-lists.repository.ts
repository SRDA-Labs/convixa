/**
 * Address lists (vendors, sponsors, token_contracts) and entries.
 */

import { and, eq, inArray } from "drizzle-orm";
import { getAddress } from "viem";
import { db } from "../index";
import { addressLists, addressListEntries } from "../schema";
import { firstOrNull } from "../utils/queries";
import type { DbResult } from "../types";

export type OrgAddressListMatch = {
  listId: string;
  listName: string;
  entryId: string;
  entryLabel: string | null;
};

/** First org address list that contains this address (any list type). */
export async function findAddressInOrgAddressLists(
  orgId: string,
  address: string
): Promise<OrgAddressListMatch | null> {
  let normalized: string;
  try {
    normalized = getAddress(address).toLowerCase();
  } catch {
    return null;
  }

  const rows = await db
    .select({
      listId: addressLists.id,
      listName: addressLists.name,
      entryId: addressListEntries.id,
      entryLabel: addressListEntries.label,
      address: addressListEntries.address,
    })
    .from(addressListEntries)
    .innerJoin(addressLists, eq(addressListEntries.listId, addressLists.id))
    .where(eq(addressLists.orgId, orgId));

  for (const row of rows) {
    try {
      if (getAddress(row.address).toLowerCase() === normalized) {
        return {
          listId: row.listId,
          listName: row.listName,
          entryId: row.entryId,
          entryLabel: row.entryLabel ?? null,
        };
      }
    } catch {
      // skip invalid stored address
    }
  }
  return null;
}

export async function createAddressList(data: {
  orgId: string;
  name: string;
  type: string;
  createdByUserId?: string | null;
}) {
  const [list] = await db
    .insert(addressLists)
    .values({
      orgId: data.orgId,
      name: data.name,
      type: data.type,
      createdByUserId: data.createdByUserId ?? null,
    })
    .returning();
  return firstOrNull([list]);
}

export async function getAddressListById(id: string): Promise<DbResult<typeof addressLists.$inferSelect>> {
  const results = await db.select().from(addressLists).where(eq(addressLists.id, id)).limit(1);
  return firstOrNull(results);
}

export async function getAddressListsByOrg(orgId: string) {
  return await db
    .select()
    .from(addressLists)
    .where(eq(addressLists.orgId, orgId))
    .orderBy(addressLists.createdAt);
}

export async function updateAddressList(id: string, data: { name?: string; type?: string }) {
  const updates: { name?: string; type?: string } = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.type !== undefined) updates.type = data.type;
  if (Object.keys(updates).length === 0) return getAddressListById(id);
  const [updated] = await db.update(addressLists).set(updates).where(eq(addressLists.id, id)).returning();
  return firstOrNull([updated]);
}

export async function deleteAddressList(id: string): Promise<boolean> {
  try {
    await db.delete(addressLists).where(eq(addressLists.id, id));
    return true;
  } catch {
    return false;
  }
}

export async function getAddressListEntries(listId: string) {
  return await db
    .select()
    .from(addressListEntries)
    .where(eq(addressListEntries.listId, listId))
    .orderBy(addressListEntries.address);
}

export async function getAddressListEntryById(entryId: string, listId: string) {
  const rows = await db
    .select()
    .from(addressListEntries)
    .where(and(eq(addressListEntries.id, entryId), eq(addressListEntries.listId, listId)))
    .limit(1);
  return firstOrNull(rows);
}

export async function updateAddressListEntry(
  entryId: string,
  listId: string,
  data: {
    label?: string | null;
    notes?: string | null;
    tags?: string[] | null;
    address?: string;
  }
) {
  const updates: {
    label?: string | null;
    notes?: string | null;
    tags?: string[] | null;
    address?: string;
  } = {};
  if (data.label !== undefined) updates.label = data.label;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.tags !== undefined) updates.tags = data.tags;
  if (data.address !== undefined) updates.address = data.address;
  if (Object.keys(updates).length === 0) return getAddressListEntryById(entryId, listId);

  const [updated] = await db
    .update(addressListEntries)
    .set(updates)
    .where(and(eq(addressListEntries.id, entryId), eq(addressListEntries.listId, listId)))
    .returning();
  return firstOrNull([updated]);
}

export async function addAddressListEntries(
  listId: string,
  entries: {
    address: string;
    label?: string | null;
    notes?: string | null;
    tags?: string[] | null;
    metadata?: Record<string, unknown>;
  }[]
) {
  if (entries.length === 0) return [];
  const inserted = await db
    .insert(addressListEntries)
    .values(
      entries.map((e) => ({
        listId,
        address: e.address,
        label: e.label ?? null,
        notes: e.notes ?? null,
        tags: e.tags ?? null,
        metadata: e.metadata ?? null,
      }))
    )
    .onConflictDoNothing({ target: [addressListEntries.listId, addressListEntries.address] })
    .returning();
  return inserted;
}

export async function removeAddressListEntry(listId: string, address: string): Promise<boolean> {
  try {
    await db
      .delete(addressListEntries)
      .where(and(eq(addressListEntries.listId, listId), eq(addressListEntries.address, address)));
    return true;
  } catch {
    return false;
  }
}

export async function removeAddressListEntries(listId: string, addresses: string[]): Promise<number> {
  if (addresses.length === 0) return 0;
  const deleted = await db
    .delete(addressListEntries)
    .where(and(eq(addressListEntries.listId, listId), inArray(addressListEntries.address, addresses)))
    .returning({ id: addressListEntries.id });
  return deleted.length;
}
