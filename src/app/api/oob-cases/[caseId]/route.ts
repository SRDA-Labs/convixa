import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, parseRequestBody } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import { getDefaultOrgId } from "@/lib/auth-server";
import {
  getOobCaseById,
  updateOobCase,
  getOobEvidenceByCase,
  getOobConfirmationsByCase,
} from "@/lib/db/repositories/operational-workflows.repository";
import { createAuditLog } from "@/lib/db/repositories/audit.repository";

const patchSchema = z.object({
  status: z
    .enum([
      "open",
      "evidence_gathering",
      "pending_confirmations",
      "verified",
      "rejected",
      "expired",
    ])
    .optional(),
  description: z.string().max(5000).nullable().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const orgId = await getDefaultOrgId();
  if (!orgId) return NextResponse.json({ error: "Not in an org" }, { status: 403 });

  const { caseId } = await params;
  if (!uuidSchema.safeParse(caseId).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const oobCase = await getOobCaseById(caseId);
  if (!oobCase || oobCase.orgId !== orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [evidence, confirmations] = await Promise.all([
    getOobEvidenceByCase(caseId),
    getOobConfirmationsByCase(caseId),
  ]);

  return NextResponse.json({ case: oobCase, evidence, confirmations });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const orgId = await getDefaultOrgId();
  if (!orgId) return NextResponse.json({ error: "Not in an org" }, { status: 403 });

  const { caseId } = await params;
  if (!uuidSchema.safeParse(caseId).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const oobCase = await getOobCaseById(caseId);
  if (!oobCase || oobCase.orgId !== orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await parseRequestBody(req, patchSchema);
  if ("error" in body) return body.error;

  const updated = await updateOobCase(caseId, {
    ...body.data,
    verifiedAt: body.data.status === "verified" ? new Date() : undefined,
  });

  if (body.data.status === "verified") {
    await createAuditLog({
      orgId,
      userId: auth.userId,
      action: "oob.case.verified",
      resourceType: "oob_case",
      resourceId: caseId,
      metadata: {},
    });
  }

  return NextResponse.json({ case: updated });
}
