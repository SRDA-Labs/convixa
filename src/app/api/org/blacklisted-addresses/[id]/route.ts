import { NextResponse } from "next/server";
import { getCurrentUser, getDefaultOrgId, isOrgAdmin } from "@/lib/auth-server";
import { invalidateSafeBlacklistChecksForOrg } from "@/lib/safe-blacklist-history";
import { db } from "@/lib/db";
import { orgBlacklistedAddresses } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getDefaultOrgId();
  if (!orgId) return NextResponse.json({ error: "Not in an org" }, { status: 403 });
  if (!(await isOrgAdmin(orgId))) {
    return NextResponse.json({ error: "Forbidden. Org admin only." }, { status: 403 });
  }

  const { id } = await params;
  const [deleted] = await db
    .delete(orgBlacklistedAddresses)
    .where(and(eq(orgBlacklistedAddresses.id, id), eq(orgBlacklistedAddresses.orgId, orgId)))
    .returning({ id: orgBlacklistedAddresses.id });
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await invalidateSafeBlacklistChecksForOrg(orgId);
  return NextResponse.json({ ok: true });
}
