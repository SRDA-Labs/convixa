import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { inArray } from "drizzle-orm";
import { requireAuthOrgPermission, parseRequestBody } from "@/lib/api-helpers";
import {
  getAddressListsByOrg,
  createAddressList,
  getAddressListEntries,
} from "@/lib/db/repositories/address-lists.repository";
import { ADDRESS_LIST_TYPES } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const createListSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(ADDRESS_LIST_TYPES),
});

export async function GET() {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const lists = await getAddressListsByOrg(orgId);
  const withDetails = await Promise.all(
    lists.map(async (list) => {
      const entries = await getAddressListEntries(list.id);
      return {
        id: list.id,
        orgId: list.orgId,
        name: list.name,
        type: list.type,
        createdAt: list.createdAt,
        createdByUserId: list.createdByUserId,
        entryCount: entries.length,
        entryPreview: entries.slice(0, 3).map((e) => e.label ?? e.address),
      };
    })
  );

  const userIds = [...new Set(withDetails.map((l) => l.createdByUserId).filter(Boolean))] as string[];
  let creatorMap = new Map<string, string | null>();
  if (userIds.length > 0) {
    const creatorRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, userIds));
    creatorMap = new Map(creatorRows.map((r) => [r.id, r.name ?? null]));
  }

  const listsWithCreator = withDetails.map((l) => ({
    id: l.id,
    orgId: l.orgId,
    name: l.name,
    type: l.type,
    createdAt: l.createdAt,
    createdByUserId: l.createdByUserId,
    entryCount: l.entryCount,
    entryPreview: l.entryPreview,
    createdByName: l.createdByUserId ? creatorMap.get(l.createdByUserId) ?? null : null,
  }));

  return NextResponse.json({ lists: listsWithCreator });
}

export async function POST(req: NextRequest) {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId, user } = result;

  const parseResult = await parseRequestBody(req, createListSchema);
  if ("error" in parseResult) return parseResult.error;
  const { name, type } = parseResult.data;

  const list = await createAddressList({
    orgId,
    name,
    type,
    createdByUserId: user.id,
  });
  if (!list) return NextResponse.json({ error: "Failed to create list" }, { status: 500 });

  return NextResponse.json({
    list: {
      id: list.id,
      orgId: list.orgId,
      name: list.name,
      type: list.type,
      createdAt: list.createdAt,
      createdByUserId: list.createdByUserId,
    },
  });
}
