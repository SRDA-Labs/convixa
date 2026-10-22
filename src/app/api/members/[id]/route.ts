import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { orgMembers, roles } from "@/lib/db/schema";
import { getDefaultOrgId, hasPermission, updateMemberRole } from "@/lib/auth-server";
import { requireActiveOrg } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";

const uuidSchema = z.string().uuid("Invalid resource id");
const patchSchema = z.object({
  roleId: z.string().uuid().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const orgResult = await requireActiveOrg();
  if (orgResult instanceof NextResponse) return orgResult;
  const { orgId } = orgResult;

  if (!(await hasPermission("members:update", orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });
  }
  const membershipId = idParsed.data;

  const [m] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.id, membershipId), eq(orgMembers.orgId, orgId)))
    .limit(1);

  if (!m) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (m.role === "admin" || m.role === "owner") {
    return NextResponse.json({ error: "Cannot change an admin or owner's role" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  let roleId: string | null = parsed.data.roleId;
  if (roleId) {
    const [r] = await db
      .select()
      .from(roles)
      .where(and(eq(roles.id, roleId), eq(roles.orgId, orgId)))
      .limit(1);
    if (!r) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  await db
    .update(orgMembers)
    .set({ roleId, updatedAt: new Date() })
    .where(eq(orgMembers.id, membershipId));

  return NextResponse.json({ ok: true });
}
