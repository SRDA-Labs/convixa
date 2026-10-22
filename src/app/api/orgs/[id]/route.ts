import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { orgs, orgMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/api-helpers";
import { isOrgAdmin } from "@/lib/auth-server";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 3; // org deletions per window

const paramsSchema = z.object({ id: z.string().uuid() });

const patchSchema = z.object({
  name: z.string().min(1, "Organization name required").max(120).transform((s) => s.trim()),
});

/**
 * PATCH /api/orgs/[id]
 * Update organization settings (name). Org admins and owners only.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const parsedParams = paramsSchema.safeParse({ id });
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid org id" }, { status: 400 });
  }
  const orgId = parsedParams.data.id;

  if (!(await isOrgAdmin(orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsedBody = patchSchema.safeParse(body);
  if (!parsedBody.success) {
    const message = parsedBody.error.flatten().fieldErrors.name?.[0] ?? "Invalid input";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const [org] = await db
    .select({ id: orgs.id, name: orgs.name, deletedAt: orgs.deletedAt })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);

  if (!org || org.deletedAt) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const [updated] = await db
    .update(orgs)
    .set({ name: parsedBody.data.name, updatedAt: new Date() })
    .where(eq(orgs.id, orgId))
    .returning({ id: orgs.id, name: orgs.name });

  logAudit({
    orgId,
    userId,
    action: "org.updated",
    resourceType: "org",
    resourceId: orgId,
    metadata: { previousName: org.name, name: updated?.name },
  }).catch(() => {});

  return NextResponse.json({ ok: true, name: updated?.name });
}

/**
 * DELETE /api/orgs/[id]
 * Soft-deletes an organization. Only the org owner can delete.
 * The org is marked with deletedAt; all FK cascade deletes will be handled by the DB.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  // Rate limit org deletions
  const identifier = getClientIdentifier(_req);
  const { ok: withinLimit } = checkRateLimit(identifier, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX);
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 }
    );
  }

  const { id } = await params;
  const parsed = paramsSchema.safeParse({ id });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid org id" }, { status: 400 });
  }
  const orgId = parsed.data.id;

  // Verify the requesting user is the owner of this org
  const [membership] = await db
    .select({ role: orgMembers.role })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this org" }, { status: 403 });
  }
  if (membership.role !== "owner") {
    return NextResponse.json({ error: "Only the organization owner can delete it" }, { status: 403 });
  }

  // Check org exists and not already deleted
  const [org] = await db
    .select({ id: orgs.id, name: orgs.name, deletedAt: orgs.deletedAt })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  if (org.deletedAt) {
    return NextResponse.json({ error: "Organization already deleted" }, { status: 400 });
  }

  // Soft-delete: mark deletedAt timestamp
  await db
    .update(orgs)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(orgs.id, orgId));

  logAudit({
    orgId,
    userId,
    action: "org.deleted",
    resourceType: "org",
    resourceId: orgId,
    metadata: { orgName: org.name },
  }).catch(() => {});

  return NextResponse.json({ ok: true, message: "Organization deleted" });
}
