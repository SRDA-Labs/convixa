import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getDefaultOrgId, isOrgAdmin } from "@/lib/auth-server";
import { invalidateSafeBlacklistChecksForOrg } from "@/lib/safe-blacklist-history";
import { db } from "@/lib/db";
import { orgBlacklistedAddresses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getAddress, isAddress } from "viem";

const postSchema = z.object({
  addresses: z.union([
    z.string().min(1).transform((s) => [s.trim()]),
    z.array(z.string().min(1).transform((s) => s.trim())),
  ]),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getDefaultOrgId();
  if (!orgId) return NextResponse.json({ error: "Not in an org" }, { status: 403 });
  if (!(await isOrgAdmin(orgId))) {
    return NextResponse.json({ error: "Forbidden. Org admin only." }, { status: 403 });
  }

  const rows = await db
    .select()
    .from(orgBlacklistedAddresses)
    .where(eq(orgBlacklistedAddresses.orgId, orgId))
    .orderBy(orgBlacklistedAddresses.address);
  return NextResponse.json({ addresses: rows });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getDefaultOrgId();
  if (!orgId) return NextResponse.json({ error: "Not in an org" }, { status: 403 });
  if (!(await isOrgAdmin(orgId))) {
    return NextResponse.json({ error: "Forbidden. Org admin only." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input. Provide addresses (string or array)." }, { status: 400 });
  }
  const raw = parsed.data.addresses;
  const list = Array.isArray(raw) ? raw : [raw];
  const toInsert: string[] = [];
  for (const a of list) {
    if (!isAddress(a)) continue;
    toInsert.push(getAddress(a));
  }
  const unique = [...new Set(toInsert)];

  if (unique.length === 0) {
    return NextResponse.json({ error: "No valid Ethereum addresses to add." }, { status: 400 });
  }

  const inserted = await db
    .insert(orgBlacklistedAddresses)
    .values(unique.map((address) => ({ orgId, address, createdByUserId: user.id })))
    .onConflictDoNothing({ target: [orgBlacklistedAddresses.orgId, orgBlacklistedAddresses.address] })
    .returning({ id: orgBlacklistedAddresses.id, address: orgBlacklistedAddresses.address });

  await invalidateSafeBlacklistChecksForOrg(orgId);
  return NextResponse.json({ added: inserted.length, addresses: inserted });
}
