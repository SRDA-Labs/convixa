import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

/** GET /api/profile/activity – recent audit events for the current user. */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(eq(auditLogs.userId, auth.userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(10);

  const events = rows.map((row) => ({
    id: row.id,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    metadata: row.metadata,
    createdAt: row.createdAt?.toISOString() ?? null,
  }));

  return NextResponse.json({ events });
}
