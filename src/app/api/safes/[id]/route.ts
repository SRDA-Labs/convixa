import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safes, safeSnapshots, teams } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth, validateSafeAccess, requireActiveOrg } from "@/lib/api-helpers";
import { canManageTeam } from "@/lib/auth-server";
import { logAudit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validations";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });
  }
  const safeId = parsed.data;

  const safeResult = await validateSafeAccess(safeId);
  if (safeResult instanceof NextResponse) return safeResult;

  const { safe } = safeResult;

  const [snapshot] = await db
    .select()
    .from(safeSnapshots)
    .where(eq(safeSnapshots.safeId, safeId))
    .orderBy(desc(safeSnapshots.refreshedAt))
    .limit(1);

  const [team] = await db.select().from(teams).where(eq(teams.id, safe.teamId)).limit(1);

  return NextResponse.json({
    safe: {
      ...safe,
      teamName: team?.name,
      snapshot: snapshot
        ? {
            threshold: snapshot.threshold,
            owners: snapshot.owners,
            nonce: snapshot.nonce,
            pendingCount: snapshot.pendingCount,
            lastTxAt: snapshot.lastTxAt,
            refreshedAt: snapshot.refreshedAt,
          }
        : null,
    },
  });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const parsed = uuidSchema.safeParse((await context.params).id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });
  }
  const safeId = parsed.data;

  const orgResult = await requireActiveOrg();
  if (orgResult instanceof NextResponse) return orgResult;

  const safeResult = await validateSafeAccess(safeId);
  if (safeResult instanceof NextResponse) return safeResult;

  const { safe } = safeResult;

  if (!(await canManageTeam(safe.teamId))) {
    return NextResponse.json({ error: "Not allowed to delete this safe" }, { status: 403 });
  }

  await db.delete(safes).where(eq(safes.id, safeId));

  logAudit({
    orgId: safe.orgId,
    userId: null, // will be inferred from auth context
    action: "safe.delete",
    resourceType: "safe",
    resourceId: safeId,
    metadata: { address: safe.address, network: safe.network },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
