import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAddress } from "viem";
import { requireAuthOrgPermission, parseRequestBody } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import {
  getAddressListById,
  getAddressListEntries,
  addAddressListEntries,
  removeAddressListEntries,
} from "@/lib/db/repositories/address-lists.repository";
import { isDirectoryList } from "@/lib/address-lists/constants";

const entryMetadataSchema = z
  .object({
    maxAmountPerTx: z.string().optional(),
    maxAmountPerMonth: z.string().optional(),
    token: z.string().optional(),
  })
  .passthrough();

const addEntriesSchema = z.object({
  entries: z.array(
    z.object({
      address: z.string().min(1),
      label: z.string().min(1).max(200).optional(),
      notes: z.string().max(1000).optional(),
      tags: z.array(z.string().min(1).max(40)).max(10).optional(),
      metadata: entryMetadataSchema.optional(),
    })
  ),
});

const removeEntriesSchema = z.object({
  addresses: z.array(z.string().min(1)),
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
  return NextResponse.json({ entries });
}

export async function POST(
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

  const parseResult = await parseRequestBody(req, addEntriesSchema);
  if ("error" in parseResult) return parseResult.error;

  const directory = isDirectoryList(list.type);
  const toAdd: {
    address: string;
    label?: string | null;
    notes?: string | null;
    tags?: string[] | null;
    metadata?: Record<string, unknown>;
  }[] = [];

  for (const e of parseResult.data.entries) {
    try {
      const address = getAddress(e.address);
      if (directory && !e.label?.trim()) {
        continue;
      }
      toAdd.push({
        address,
        label: e.label?.trim() ?? null,
        notes: e.notes?.trim() ?? null,
        tags: e.tags ?? null,
        metadata: e.metadata as Record<string, unknown> | undefined,
      });
    } catch {
      // skip invalid address
    }
  }

  if (toAdd.length === 0) {
    const msg = directory
      ? "No valid entries. Directory lists require a name and Ethereum address for each entry."
      : "No valid Ethereum addresses to add.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const inserted = await addAddressListEntries(idParsed.data, toAdd);
  return NextResponse.json({
    added: inserted.length,
    skipped: toAdd.length - inserted.length,
    entries: inserted,
  });
}

export async function DELETE(
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

  const parseResult = await parseRequestBody(req, removeEntriesSchema);
  if ("error" in parseResult) return parseResult.error;

  const normalized = parseResult.data.addresses.map((a) => {
    try {
      return getAddress(a);
    } catch {
      return a;
    }
  });
  const removed = await removeAddressListEntries(idParsed.data, normalized);
  return NextResponse.json({ removed });
}
