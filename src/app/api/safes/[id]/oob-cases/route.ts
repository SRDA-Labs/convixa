import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, validateSafeAccess, parseRequestBody } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import {
  getOobCasesBySafe,
  createOobCase,
  getOobCaseBySafeTxHash,
} from "@/lib/db/repositories/operational-workflows.repository";
import { getOobVerificationSlaHours } from "@/lib/operational-workflows/config";
import { createAuditLog } from "@/lib/db/repositories/audit.repository";

const createSchema = z.object({
  safeTxHash: z.string().optional(),
  configEventId: z.string().uuid().optional(),
  normalizedEventId: z.string().uuid().optional(),
  caseType: z.enum([
    "signer_add",
    "signer_remove",
    "threshold_change",
    "guard_module_change",
    "other",
  ]),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid safe id" }, { status: 400 });
  }

  const access = await validateSafeAccess(id);
  if (access instanceof NextResponse) return access;

  const cases = await getOobCasesBySafe(id);
  return NextResponse.json({ cases });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid safe id" }, { status: 400 });
  }

  const access = await validateSafeAccess(id);
  if (access instanceof NextResponse) return access;
  const { safe } = access;

  const body = await parseRequestBody(req, createSchema);
  if ("error" in body) return body.error;
  const data = body.data;

  if (data.safeTxHash) {
    const existing = await getOobCaseBySafeTxHash(safe.id, data.safeTxHash);
    if (existing) {
      return NextResponse.json({ case: existing }, { status: 200 });
    }
  }

  const dueAt = new Date(Date.now() + getOobVerificationSlaHours() * 3600000);

  const oobCase = await createOobCase({
    orgId: safe.orgId,
    safeId: safe.id,
    safeTxHash: data.safeTxHash ?? null,
    configEventId: data.configEventId ?? null,
    normalizedEventId: data.normalizedEventId ?? null,
    caseType: data.caseType,
    title: data.title,
    description: data.description ?? null,
    dueAt,
    openedByUserId: auth.userId,
  });

  await createAuditLog({
    orgId: safe.orgId,
    userId: auth.userId,
    action: "oob.case.opened",
    resourceType: "safe",
    resourceId: safe.id,
    metadata: { caseId: oobCase?.id, safeTxHash: data.safeTxHash },
  });

  return NextResponse.json({ case: oobCase }, { status: 201 });
}
