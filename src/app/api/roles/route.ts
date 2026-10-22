import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { roles } from "@/lib/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { eq, and } from "drizzle-orm";
import { requireAuthOrgPermission, parseRequestBody } from "@/lib/api-helpers";

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9_-]+$/),
  permissions: z.array(z.string()),
});

export async function GET() {
  const result = await requireAuthOrgPermission("roles:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const list = await db.select().from(roles).where(eq(roles.orgId, orgId)).orderBy(roles.createdAt);
  return NextResponse.json({ roles: list });
}

export async function POST(req: Request) {
  const result = await requireAuthOrgPermission("roles:create");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const parseResult = await parseRequestBody(req, createSchema);
  if ("error" in parseResult) return parseResult.error;
  const parsed = parseResult.data;
  const { name, slug, permissions } = parsed;
  const validPerms = permissions.filter((p) => (PERMISSIONS as readonly string[]).includes(p));
  const [existing] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.orgId, orgId), eq(roles.slug, slug)))
    .limit(1);
  if (existing) {
    return NextResponse.json({ error: "A role with this slug already exists" }, { status: 409 });
  }
  await db.insert(roles).values({
    orgId,
    name,
    slug,
    permissions: validPerms,
  });
  const [created] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.orgId, orgId), eq(roles.slug, slug)))
    .limit(1);
  return NextResponse.json({ ok: true, role: created });
}
