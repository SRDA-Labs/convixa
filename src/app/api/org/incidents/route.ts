import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndOrg, parseRequestBody } from "@/lib/api-helpers";
import {
  getSecurityIncidentsByOrg,
  createSecurityIncident,
  logIncidentActivity,
  getOrgAdminEmails,
  updateSecurityIncident,
} from "@/lib/db/repositories/operational-workflows.repository";
import { createAuditLog } from "@/lib/db/repositories/audit.repository";
import { sendSecurityIncidentEmail } from "@/lib/email";
import { getSecurityContactEmail } from "@/lib/operational-workflows/config";
import { hasPermission } from "@/lib/auth-server";

const createSchema = z.object({
  incidentType: z.enum([
    "key_compromise",
    "key_loss",
    "suspicious_tx",
    "comms_compromise",
    "oob_failure",
    "other",
  ]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  title: z.string().min(1).max(300),
  description: z.string().max(10000).optional(),
  affectedSafeIds: z.array(z.string().uuid()).optional(),
  affectedSignerAddresses: z.array(z.string()).optional(),
  linkedOobCaseId: z.string().uuid().optional(),
  linkedSafeTxHash: z.string().optional(),
});

export async function GET() {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:read", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const incidents = await getSecurityIncidentsByOrg(auth.orgId);
  return NextResponse.json({ incidents });
}

export async function POST(req: Request) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  const body = await parseRequestBody(req, createSchema);
  if ("error" in body) return body.error;

  const description =
    body.data.description?.trim() ||
    "Incident reported — add details on the tracking page.";

  const incident = await createSecurityIncident({
    orgId: auth.orgId,
    reporterUserId: auth.userId,
    ...body.data,
    description,
  });

  if (incident) {
    await logIncidentActivity({
      incidentId: incident.id,
      userId: auth.userId,
      action: "reported",
      summary: `Incident reported: ${body.data.title}`,
      metadata: {
        severity: body.data.severity,
        incidentType: body.data.incidentType,
      },
    });
  }

  await createAuditLog({
    orgId: auth.orgId,
    userId: auth.userId,
    action: "incident.reported",
    resourceType: "incident",
    resourceId: incident?.id,
    metadata: {
      incidentType: body.data.incidentType,
      severity: body.data.severity,
    },
  });

  const contactEmail = getSecurityContactEmail();
  const notifiedAt = new Date();
  const emailTargets = new Set<string>();

  if (contactEmail) emailTargets.add(contactEmail);

  const admins = await getOrgAdminEmails(auth.orgId);
  for (const admin of admins) {
    if (admin.email) emailTargets.add(admin.email);
  }

  if (incident && emailTargets.size > 0) {
    const emailPayload = {
      title: body.data.title,
      severity: body.data.severity,
      incidentType: body.data.incidentType,
      description,
      incidentId: incident.id,
    };
    for (const to of emailTargets) {
      sendSecurityIncidentEmail(to, emailPayload).catch((err) =>
        console.error("[incidents] email failed:", err)
      );
    }
    await updateSecurityIncident(incident.id, {
      securityContactNotifiedAt: notifiedAt,
    });
  }

  return NextResponse.json({ incident }, { status: 201 });
}
