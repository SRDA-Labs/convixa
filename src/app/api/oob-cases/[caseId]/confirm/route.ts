import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, parseRequestBody } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import { getDefaultOrgId } from "@/lib/auth-server";
import {
  getOobCaseById,
  addOobConfirmation,
  getOobConfirmationsByCase,
  getOobEvidenceByCase,
  updateOobCase,
} from "@/lib/db/repositories/operational-workflows.repository";
import { getRosterBySafeId } from "@/lib/db/repositories/safe-signer-roster.repository";
import { createAuditLog } from "@/lib/db/repositories/audit.repository";

const bodySchema = z.object({
  rosterId: z.string().uuid().optional(),
  confirmationText: z.string().max(1000).optional(),
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

  const confirmation = await addOobConfirmation({
    caseId,
    rosterId: body.data.rosterId ?? null,
    userId: auth.userId,
    confirmationText: body.data.confirmationText ?? null,
  });

  const [evidence, confirmations, roster] = await Promise.all([
    getOobEvidenceByCase(caseId),
    getOobConfirmationsByCase(caseId),
    getRosterBySafeId(oobCase.safeId),
  ]);

  const activeSigners = roster.filter((r) => !r.removedAt);
  const quorum = Math.ceil(activeSigners.length / 2);
  const requiredChannels = (oobCase.requiredChannels as string[]) ?? [];

  const channelsCovered = new Set(evidence.map((e) => e.channel));
  const hasAllChannels = requiredChannels.every((c) => channelsCovered.has(c));

  if (oobCase.status === "evidence_gathering" && hasAllChannels) {
    await updateOobCase(caseId, { status: "pending_confirmations" });
  }

  if (confirmations.length >= quorum && hasAllChannels) {
    await updateOobCase(caseId, { status: "verified", verifiedAt: new Date() });
    await createAuditLog({
      orgId,
      userId: auth.userId,
      action: "oob.case.verified",
      resourceType: "oob_case",
      resourceId: caseId,
      metadata: { quorum, confirmations: confirmations.length },
    });
  }

  return NextResponse.json({ confirmation });
}
