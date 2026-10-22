import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndOrg, parseRequestBody } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import {
  getSecurityIncidentDetail,
  getIncidentUpdatesWithUsers,
  getIncidentParticipants,
  getIncidentActivity,
  updateSecurityIncident,
  logIncidentActivity,
} from "@/lib/db/repositories/operational-workflows.repository";
import { createAuditLog } from "@/lib/db/repositories/audit.repository";
import { resolveIncidentAccess } from "@/lib/incidents/service";
import { canManageIncident } from "@/lib/incidents/access";
import {
  INCIDENT_STATUSES,
  RESOLUTION_REQUIRED_STATUSES,
  INCIDENT_STATUS_LABEL,
} from "@/lib/incidents/constants";

const patchSchema = z
  .object({
    status: z.enum(INCIDENT_STATUSES).optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    description: z.string().min(1).max(10000).optional(),
    resolutionNotes: z.string().min(10).max(5000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.status &&
      RESOLUTION_REQUIRED_STATUSES.includes(data.status) &&
      (!data.resolutionNotes || data.resolutionNotes.trim().length < 10)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Resolution notes (min 10 characters) are required when resolving or closing an incident.",
        path: ["resolutionNotes"],
      });
    }
  });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const resolved = await resolveIncidentAccess(id, auth.userId, auth.orgId);
  if (!resolved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!resolved.canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [incident, updates, participants, activity] = await Promise.all([
    getSecurityIncidentDetail(id),
    getIncidentUpdatesWithUsers(id),
    getIncidentParticipants(id),
    getIncidentActivity(id, 50),
  ]);

  return NextResponse.json({
    incident,
    updates,
    participants,
    activity,
    capabilities: resolved.capabilities,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const resolved = await resolveIncidentAccess(id, auth.userId, auth.orgId);
  if (!resolved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canManageIncident(resolved.access)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await parseRequestBody(req, patchSchema);
  if ("error" in body) return body.error;

  const incident = resolved.incident;
  const patchData: Parameters<typeof updateSecurityIncident>[1] = {};
  const activityEntries: Array<{
    action: string;
    summary: string;
    metadata?: Record<string, unknown>;
  }> = [];

  if (body.data.status && body.data.status !== incident.status) {
    patchData.status = body.data.status;
    if (body.data.status === "resolved" || body.data.status === "closed") {
      patchData.resolvedAt = new Date();
      if (body.data.resolutionNotes) {
        patchData.resolutionNotes = body.data.resolutionNotes;
      }
    }
    activityEntries.push({
      action: "status_changed",
      summary: `Status changed to ${INCIDENT_STATUS_LABEL[body.data.status]}`,
      metadata: { from: incident.status, to: body.data.status },
    });
  }

  if (body.data.severity && body.data.severity !== incident.severity) {
    patchData.severity = body.data.severity;
    activityEntries.push({
      action: "severity_changed",
      summary: `Severity changed from ${incident.severity} to ${body.data.severity}`,
      metadata: { from: incident.severity, to: body.data.severity },
    });
  }

  if (body.data.description && body.data.description !== incident.description) {
    patchData.description = body.data.description;
    activityEntries.push({
      action: "description_updated",
      summary: "Incident description updated",
    });
  }

  if (
    body.data.resolutionNotes !== undefined &&
    body.data.resolutionNotes !== incident.resolutionNotes &&
    !patchData.resolutionNotes
  ) {
    patchData.resolutionNotes = body.data.resolutionNotes;
  }

  if (Object.keys(patchData).length === 0) {
    return NextResponse.json({ incident });
  }

  const updated = await updateSecurityIncident(id, patchData);
  if (!updated) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  for (const entry of activityEntries) {
    await logIncidentActivity({
      incidentId: id,
      userId: auth.userId,
      ...entry,
    });
  }

  if (body.data.status) {
    await createAuditLog({
      orgId: auth.orgId,
      userId: auth.userId,
      action: "incident.status_changed",
      resourceType: "incident",
      resourceId: id,
      metadata: { status: body.data.status },
    });
  }

  return NextResponse.json({ incident: updated });
}
