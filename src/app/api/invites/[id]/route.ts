import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invites } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getDefaultOrgId, isOrgAdmin, getDefaultTeams } from "@/lib/auth-server";
import { requireAuth } from "@/lib/api-helpers";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const orgId = await getDefaultOrgId();
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

  const parseResult = paramsSchema.safeParse(await context.params);
  if (!parseResult.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const { id } = parseResult.data;

  const [inv] = await db
    .select()
    .from(invites)
    .where(and(eq(invites.id, id), eq(invites.orgId, orgId)))
    .limit(1);

  if (!inv) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (inv.status !== "pending") return NextResponse.json({ error: "Invite is not pending" }, { status: 400 });

  const admin = await isOrgAdmin(orgId);
  const userTeams = await getDefaultTeams();
  const canManage = admin || userTeams.some((t) => t.teamId === inv.teamId && t.role === "lead");
  if (!canManage) return NextResponse.json({ error: "Not allowed to cancel this invite" }, { status: 403 });

  await db.delete(invites).where(eq(invites.id, id));
  return NextResponse.json({ ok: true });
}
