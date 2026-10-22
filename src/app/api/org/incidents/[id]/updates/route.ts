import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndOrg, parseRequestBody } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import {
  addIncidentUpdate,
  logIncidentActivity,
} from "@/lib/db/repositories/operational-workflows.repository";
import { resolveIncidentAccess } from "@/lib/incidents/service";
import { canCommentOnIncident } from "@/lib/incidents/access";

const bodySchema = z.object({
  body: z.string().min(1).max(5000),
});

export async function POST(
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
  if (!canCommentOnIncident(resolved.access)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await parseRequestBody(req, bodySchema);
  if ("error" in body) return body.error;

  const update = await addIncidentUpdate({
    incidentId: id,
    userId: auth.userId,
    body: body.data.body,
  });

  await logIncidentActivity({
    incidentId: id,
    userId: auth.userId,
    action: "comment_added",
    summary: "Added a comment",
    metadata: { preview: body.data.body.slice(0, 120) },
  });

  return NextResponse.json({ update }, { status: 201 });
}
