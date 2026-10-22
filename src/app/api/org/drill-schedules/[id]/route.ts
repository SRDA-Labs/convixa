import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndOrg, parseRequestBody } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import {
  getDrillScheduleById,
  updateDrillSchedule,
} from "@/lib/db/repositories/readiness.repository";
import { DRILL_CADENCES } from "@/lib/readiness/drill-types";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  cadence: z.enum(DRILL_CADENCES).optional(),
  isActive: z.boolean().optional(),
  nextDueAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:manage", auth.orgId))) {
    return NextResponse.json({ error: "Security manage permission required" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await getDrillScheduleById(id);
  if (!existing || existing.orgId !== auth.orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await parseRequestBody(req, patchSchema);
  if ("error" in body) return body.error;

  const schedule = await updateDrillSchedule(id, {
    ...body.data,
    nextDueAt:
      body.data.nextDueAt === undefined
        ? undefined
        : body.data.nextDueAt
          ? new Date(body.data.nextDueAt)
          : null,
  });

  return NextResponse.json({ schedule });
}
