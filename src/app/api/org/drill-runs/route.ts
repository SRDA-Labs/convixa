import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndOrg, parseRequestBody } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import {
  getDrillRunsByOrg,
  createDrillRun,
} from "@/lib/db/repositories/readiness.repository";
import { DRILL_TYPES, DRILL_RUN_STATUSES } from "@/lib/readiness/drill-types";

const createSchema = z.object({
  scheduleId: z.string().uuid().nullable().optional(),
  safeId: z.string().uuid().nullable().optional(),
  drillType: z.enum(DRILL_TYPES),
  title: z.string().min(1).max(200),
  scheduledAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  status: z.enum(DRILL_RUN_STATUSES),
  participantsJson: z
    .array(
      z.object({
        userId: z.string().optional(),
        name: z.string().optional(),
        role: z.string().optional(),
      })
    )
    .optional(),
  findingsJson: z
    .array(
      z.object({
        severity: z.string(),
        note: z.string(),
        followUpDueAt: z.string().optional(),
      })
    )
    .optional(),
  notes: z.string().max(5000).optional(),
});

export async function GET() {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:read", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const runs = await getDrillRunsByOrg(auth.orgId);
  return NextResponse.json({ runs });
}

export async function POST(req: Request) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:manage", auth.orgId))) {
    return NextResponse.json({ error: "Security manage permission required" }, { status: 403 });
  }

  const body = await parseRequestBody(req, createSchema);
  if ("error" in body) return body.error;

  const run = await createDrillRun({
    orgId: auth.orgId,
    scheduleId: body.data.scheduleId ?? null,
    safeId: body.data.safeId ?? null,
    drillType: body.data.drillType,
    title: body.data.title,
    scheduledAt: body.data.scheduledAt ? new Date(body.data.scheduledAt) : null,
    completedAt: body.data.completedAt ? new Date(body.data.completedAt) : null,
    status: body.data.status,
    participantsJson: body.data.participantsJson,
    findingsJson: body.data.findingsJson,
    notes: body.data.notes ?? null,
    createdByUserId: auth.userId,
  });

  return NextResponse.json({ run }, { status: 201 });
}
