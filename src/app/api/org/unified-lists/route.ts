import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { requireAuthOrgPermission } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  getAddressListsByOrg,
  getAddressListEntries,
} from "@/lib/db/repositories/address-lists.repository";
import {
  getSubscriptionListsByOrg,
  getSubscriptionListMembersWithIds,
} from "@/lib/db/repositories/subscription-lists.repository";
import { LIST_CREATION_KIND_LABEL, resolveAddressListTypeLabel, isValidAddressListType } from "@/lib/address-lists/constants";

export type UnifiedListKind = "alert_subscription" | "onchain_address_book";

export async function GET() {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const [addressLists, subscriptionLists] = await Promise.all([
    getAddressListsByOrg(orgId),
    getSubscriptionListsByOrg(orgId),
  ]);

  const addressWithDetails = await Promise.all(
    addressLists.map(async (list) => {
      const entries = await getAddressListEntries(list.id);
      return {
        id: list.id,
        kind: "onchain_address_book" as const,
        name: list.name,
        kindLabel: LIST_CREATION_KIND_LABEL.onchain_address_book,
        subType: isValidAddressListType(list.type) ? list.type : null,
        subTypeLabel: resolveAddressListTypeLabel(list.type),
        typeAssigned: isValidAddressListType(list.type),
        createdAt: list.createdAt,
        createdByUserId: list.createdByUserId,
        entryCount: entries.length,
        entryPreview: entries.slice(0, 3).map((e) => e.label ?? e.address),
      };
    })
  );

  const subscriptionWithDetails = await Promise.all(
    subscriptionLists.map(async (list) => {
      const members = await getSubscriptionListMembersWithIds(list.id);
      return {
        id: list.id,
        kind: "alert_subscription" as const,
        name: list.name,
        kindLabel: LIST_CREATION_KIND_LABEL.alert_subscription,
        subType: "alert_subscription",
        subTypeLabel: "Alert recipients",
        typeAssigned: true,
        createdAt: list.createdAt,
        createdByUserId: null as string | null,
        entryCount: members.length,
        entryPreview: members.slice(0, 3).map((m) => m.email),
      };
    })
  );

  const combined = [...addressWithDetails, ...subscriptionWithDetails].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const userIds = [
    ...new Set(combined.map((l) => l.createdByUserId).filter(Boolean)),
  ] as string[];
  let creatorMap = new Map<string, string | null>();
  if (userIds.length > 0) {
    const creatorRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, userIds));
    creatorMap = new Map(creatorRows.map((r) => [r.id, r.name ?? null]));
  }

  const lists = combined.map((l) => ({
    id: l.id,
    kind: l.kind,
    name: l.name,
    kindLabel: l.kindLabel,
    subType: l.subType,
    subTypeLabel: l.subTypeLabel,
    typeAssigned: l.typeAssigned,
    createdAt: l.createdAt.toISOString(),
    createdByUserId: l.createdByUserId,
    createdByName: l.createdByUserId ? creatorMap.get(l.createdByUserId) ?? null : null,
    entryCount: l.entryCount,
    entryPreview: l.entryPreview,
  }));

  return NextResponse.json({ lists });
}
