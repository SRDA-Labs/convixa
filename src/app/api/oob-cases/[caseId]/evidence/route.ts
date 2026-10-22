import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, parseRequestBody } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import { getDefaultOrgId } from "@/lib/auth-server";
import {
  getOobCaseById,
  addOobEvidence,
  updateOobCase,
} from "@/lib/db/repositories/operational-workflows.repository";

const bodySchema = z.object({
  channel: z.enum(["video_call", "secondary_messenger", "signed_message", "other"]),
  evidenceType: z.enum(["link", "text", "affiliation_proof_ref", "file_metadata"]),
  evidenceValue: z.string().min(1).max(5000),
});

export async function POST(
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

  const body = await parseRequestBody(req, bodySchema);
  if ("error" in body) return body.error;

  const evidence = await addOobEvidence({
    caseId,
    channel: body.data.channel,
    submittedByUserId: auth.userId,
    evidenceType: body.data.evidenceType,
    evidenceValue: body.data.evidenceValue,
  });

  if (oobCase.status === "open") {
    await updateOobCase(caseId, { status: "evidence_gathering" });
  }

  return NextResponse.json({ evidence }, { status: 201 });
}
