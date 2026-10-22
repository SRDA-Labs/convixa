import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthOrgPermission, parseRequestBody } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import {
  getAddressListById,
  updateAddressList,
  deleteAddressList,
  getAddressListEntries,
} from "@/lib/db/repositories/address-lists.repository";
import { ADDRESS_LIST_TYPES } from "@/lib/db/schema";

const updateListSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(ADDRESS_LIST_TYPES).optional(),
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

  const list = await getAddressListById(idParsed.data);
  if (!list || list.orgId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entries = await getAddressListEntries(list.id);
  return NextResponse.json({
    list: {
      id: list.id,
      orgId: list.orgId,
      name: list.name,
      type: list.type,
      createdAt: list.createdAt,
      createdByUserId: list.createdByUserId,
      entries,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const { id } = await params;
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });

  const list = await getAddressListById(idParsed.data);
  if (!list || list.orgId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parseResult = await parseRequestBody(req, updateListSchema);
  if ("error" in parseResult) return parseResult.error;

  const updated = await updateAddressList(idParsed.data, parseResult.data);
  if (!updated) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  return NextResponse.json({
    list: {
      id: updated.id,
      orgId: updated.orgId,
      name: updated.name,
      type: updated.type,
      createdAt: updated.createdAt,
      createdByUserId: updated.createdByUserId,
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

  const list = await getAddressListById(idParsed.data);
  if (!list || list.orgId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ok = await deleteAddressList(idParsed.data);
  if (!ok) return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
