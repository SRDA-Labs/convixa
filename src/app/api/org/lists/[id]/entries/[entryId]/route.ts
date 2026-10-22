import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAddress } from "viem";
import { requireAuthOrgPermission, parseRequestBody } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import {
  getAddressListById,
  getAddressListEntryById,
  updateAddressListEntry,
} from "@/lib/db/repositories/address-lists.repository";
import { isDirectoryList } from "@/lib/address-lists/constants";

const updateEntrySchema = z.object({
  label: z.string().min(1).max(200).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(10).nullable().optional(),
  address: z.string().min(1).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const { id, entryId } = await params;
  const listIdParsed = uuidSchema.safeParse(id);
  const entryIdParsed = uuidSchema.safeParse(entryId);
  if (!listIdParsed.success || !entryIdParsed.success) {
    return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });
  }

  const list = await getAddressListById(listIdParsed.data);
  if (!list || list.orgId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await getAddressListEntryById(entryIdParsed.data, list.id);
  if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  const parseResult = await parseRequestBody(req, updateEntrySchema);
  if ("error" in parseResult) return parseResult.error;

  const data = parseResult.data;
  if (isDirectoryList(list.type) && data.label === "") {
    return NextResponse.json({ error: "Directory entries require a name/label." }, { status: 400 });
  }

  let normalizedAddress: string | undefined;
  if (data.address) {
    try {
      normalizedAddress = getAddress(data.address);
    } catch {
      return NextResponse.json({ error: "Invalid Ethereum address" }, { status: 400 });
    }
  }

  const updated = await updateAddressListEntry(entryIdParsed.data, list.id, {
    label: data.label,
    notes: data.notes,
    tags: data.tags,
    address: normalizedAddress,
  });
  if (!updated) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  return NextResponse.json({ entry: updated });
}
