import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requireOrg, requirePermission, parseRequestBody } from "@/lib/api-helpers";
import {
  createSubscriptionList,
  getSubscriptionListsByOrg,
  getSubscriptionListMembersWithIds,
} from "@/lib/db/repositories/subscription-lists.repository";

const createListSchema = z.object({
  name: z.string().min(1).max(200),
});

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const orgResult = await requireOrg();
  if (orgResult instanceof NextResponse) return NextResponse.json({ lists: [] });
  const { orgId } = orgResult;

  const permResult = await requirePermission("safes:read", orgId);
  if (permResult) return permResult;

  const lists = await getSubscriptionListsByOrg(orgId);
  const withCounts = await Promise.all(
    lists.map(async (list) => {
      const members = await getSubscriptionListMembersWithIds(list.id);
      return {
        id: list.id,
        organizationId: list.organizationId,
        name: list.name,
        createdAt: list.createdAt,
        memberCount: members.length,
      };
    })
  );

  return NextResponse.json({ lists: withCounts });
}

export async function POST(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const orgResult = await requireOrg();
  if (orgResult instanceof NextResponse) return NextResponse.json({ error: "No org" }, { status: 400 });
  const { orgId } = orgResult;

  const permResult = await requirePermission("safes:read", orgId);
  if (permResult) return permResult;

  const parseResult = await parseRequestBody(req, createListSchema);
  if ("error" in parseResult) return parseResult.error;
  const { name } = parseResult.data;

  const list = await createSubscriptionList({ organizationId: orgId, name });
  if (!list) return NextResponse.json({ error: "Failed to create list" }, { status: 500 });

  return NextResponse.json({
    list: {
      id: list.id,
      organizationId: list.organizationId,
      name: list.name,
      createdAt: list.createdAt,
    },
  });
}
