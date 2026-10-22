import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndOrg, parseRequestBody } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import {
  getDrillSchedulesByOrg,
  createDrillSchedule,
  seedDefaultDrillSchedulesForOrg,
} from "@/lib/db/repositories/readiness.repository";
import { DRILL_TYPES, DRILL_CADENCES } from "@/lib/readiness/drill-types";

const createSchema = z.object({
  safeId: z.string().uuid().nullable().optional(),
  drillType: z.enum(DRILL_TYPES),
  cadence: z.enum(DRILL_CADENCES),
  title: z.string().min(1).max(200),
  nextDueAt: z.string().datetime().optional(),
});

export async function GET() {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:read", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await seedDefaultDrillSchedulesForOrg(auth.orgId);
  const schedules = await getDrillSchedulesByOrg(auth.orgId);
  return NextResponse.json({ schedules });
}

export async function POST(req: Request) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:manage", auth.orgId))) {
    return NextResponse.json({ error: "Security manage permission required" }, { status: 403 });
  }

  const body = await parseRequestBody(req, createSchema);
  if ("error" in body) return body.error;

  const schedule = await createDrillSchedule({
    orgId: auth.orgId,
    safeId: body.data.safeId ?? null,
    drillType: body.data.drillType,
    cadence: body.data.cadence,
    title: body.data.title,
    ownerUserId: auth.userId,
    nextDueAt: body.data.nextDueAt ? new Date(body.data.nextDueAt) : undefined,
  });

  return NextResponse.json({ schedule }, { status: 201 });
}
