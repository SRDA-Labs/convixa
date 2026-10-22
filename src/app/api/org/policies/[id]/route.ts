import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrgPermission, parseRequestBody } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import {
  getPolicyById,
  updatePolicy,
  deletePolicy,
} from "@/lib/db/repositories/policies.repository";
import { POLICY_SCOPES } from "@/lib/db/schema";
import { policyConfigSchema } from "@/lib/policy-engine/validation";
import { z } from "zod";

const updatePolicySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.string().min(1).max(100).optional(),
  scope: z.enum(POLICY_SCOPES).optional(),
  safeId: z.string().uuid().nullable().optional(),
  config: policyConfigSchema.optional(),
  subscriptionListId: z.string().uuid().nullable().optional(),
  enabled: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const { id } = await params;
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });

  const policy = await getPolicyById(idParsed.data);
  if (!policy || policy.orgId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    policy: {
      id: policy.id,
      orgId: policy.orgId,
      name: policy.name,
      type: policy.type,
      scope: policy.scope,
      safeId: policy.safeId,
      config: policy.config,
      subscriptionListId: policy.subscriptionListId,
      enabled: policy.enabled,
      createdAt: policy.createdAt,
      createdByUserId: policy.createdByUserId,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const { id } = await params;
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });

  const policy = await getPolicyById(idParsed.data);
  if (!policy || policy.orgId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parseResult = await parseRequestBody(req, updatePolicySchema);
  if ("error" in parseResult) return parseResult.error;

  if (parseResult.data.scope === "safe" && parseResult.data.safeId === undefined && policy.scope === "safe" && !policy.safeId) {
    // keep as is
  } else if (parseResult.data.scope === "safe" && parseResult.data.safeId === null) {
    return NextResponse.json({ error: "safeId required when scope is safe" }, { status: 400 });
  }

  const updated = await updatePolicy(idParsed.data, parseResult.data);
  if (!updated) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  return NextResponse.json({
    policy: {
      id: updated.id,
      orgId: updated.orgId,
      name: updated.name,
      type: updated.type,
      scope: updated.scope,
      safeId: updated.safeId,
      config: updated.config,
      subscriptionListId: updated.subscriptionListId,
      enabled: updated.enabled,
      createdAt: updated.createdAt,
      createdByUserId: updated.createdByUserId,
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const { id } = await params;
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });

  const policy = await getPolicyById(idParsed.data);
  if (!policy || policy.orgId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ok = await deletePolicy(idParsed.data);
  if (!ok) return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
