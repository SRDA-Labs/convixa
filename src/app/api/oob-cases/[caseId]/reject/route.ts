import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, parseRequestBody } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import { getDefaultOrgId, isOrgAdmin } from "@/lib/auth-server";
import {
  getOobCaseById,
  updateOobCase,
} from "@/lib/db/repositories/operational-workflows.repository";
import { createAuditLog } from "@/lib/db/repositories/audit.repository";

const bodySchema = z.object({
  reason: z.string().min(5).max(2000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const orgId = await getDefaultOrgId();
  if (!orgId) return NextResponse.json({ error: "Not in an org" }, { status: 403 });

  if (!(await isOrgAdmin(orgId))) {
    return NextResponse.json({ error: "Org admin required" }, { status: 403 });
  }

  const { caseId } = await params;
  if (!uuidSchema.safeParse(caseId).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const oobCase = await getOobCaseById(caseId);
  if (!oobCase || oobCase.orgId !== orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await parseRequestBody(req, bodySchema);
  if ("error" in body) return body.error;

  const updated = await updateOobCase(caseId, {
    status: "rejected",
    description: body.data.reason
      ? `${oobCase.description ?? ""}\n\nRejected: ${body.data.reason}`.trim()
      : oobCase.description,
  });

  await createAuditLog({
    orgId,
    userId: auth.userId,
    action: "oob.case.rejected",
    resourceType: "oob_case",
    resourceId: caseId,
    metadata: { reason: body.data.reason },
  });

  return NextResponse.json({ case: updated });
}
