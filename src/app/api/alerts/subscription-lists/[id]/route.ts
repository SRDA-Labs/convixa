import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthOrgPermission, parseRequestBody } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import {
  getSubscriptionListById,
  updateSubscriptionList,
  deleteSubscriptionList,
  getSubscriptionListMembersWithIds,
} from "@/lib/db/repositories/subscription-lists.repository";

const updateListSchema = z.object({
  name: z.string().min(1).max(200),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const { id } = await params;
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });

  const list = await getSubscriptionListById(idParsed.data);
  if (!list || list.organizationId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const members = await getSubscriptionListMembersWithIds(list.id);
  return NextResponse.json({
    list: {
      id: list.id,
      organizationId: list.organizationId,
      name: list.name,
      createdAt: list.createdAt,
      members,
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const { id } = await params;
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });

  const list = await getSubscriptionListById(idParsed.data);
  if (!list || list.organizationId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parseResult = await parseRequestBody(req, updateListSchema);
  if ("error" in parseResult) return parseResult.error;
  const updated = await updateSubscriptionList(idParsed.data, { name: parseResult.data.name });
  if (!updated) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  return NextResponse.json({
    list: {
      id: updated.id,
      organizationId: updated.organizationId,
      name: updated.name,
      createdAt: updated.createdAt,
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const { id } = await params;
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });

  const list = await getSubscriptionListById(idParsed.data);
  if (!list || list.organizationId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ok = await deleteSubscriptionList(idParsed.data);
  if (!ok) return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
