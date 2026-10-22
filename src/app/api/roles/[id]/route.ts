import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { roles } from "@/lib/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { eq, and } from "drizzle-orm";
import { requireAuthOrgPermission, parseRequestBody, safeJsonParse } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9_-]+$/).optional(),
  permissions: z.array(z.string()).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthOrgPermission("roles:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const { id } = await params;
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });
  const roleId = idParsed.data;
  const [r] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.orgId, orgId)))
    .limit(1);
  if (!r) return NextResponse.json({ error: "Role not found" }, { status: 404 });

  return NextResponse.json({ ...r, permissions: (r.permissions as string[]) ?? [] });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthOrgPermission("roles:update");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const { id } = await params;
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });
  const roleId = idParsed.data;
  const [existing] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.orgId, orgId)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Role not found" }, { status: 404 });

  const parseResult = await parseRequestBody(req, updateSchema);
  if ("error" in parseResult) return parseResult.error;
  const parsed = parseResult.data;
  const updates: { name?: string; slug?: string; permissions?: string[]; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (parsed.name != null) updates.name = parsed.name;
  if (parsed.slug != null) {
    const [slugTaken] = await db
      .select()
      .from(roles)
      .where(and(eq(roles.orgId, orgId), eq(roles.slug, parsed.slug)))
      .limit(1);
    if (slugTaken && slugTaken.id !== roleId) {
      return NextResponse.json({ error: "A role with this slug already exists" }, { status: 409 });
    }
    updates.slug = parsed.slug;
  }
  if (parsed.permissions != null) {
    const validPerms = parsed.permissions.filter((p) => (PERMISSIONS as readonly string[]).includes(p));
    updates.permissions = validPerms;
  }
  await db.update(roles).set(updates).where(eq(roles.id, roleId));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthOrgPermission("roles:delete");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;
  const { id } = await params;
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });
  const roleId = idParsed.data;
  const [r] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.orgId, orgId)))
    .limit(1);
  if (!r) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  await db.delete(roles).where(eq(roles.id, roleId));
  return NextResponse.json({ ok: true });
}
