import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthOrgPermission, parseRequestBody } from "@/lib/api-helpers";
import { getPoliciesByOrg, createPolicy } from "@/lib/db/repositories/policies.repository";
import { getLastFiredForPolicies } from "@/lib/db/repositories/policy-fire-log.repository";
import { POLICY_SCOPES } from "@/lib/db/schema";
import { policyConfigSchema } from "@/lib/policy-engine/validation";

const createPolicySchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(100).optional(),
  scope: z.enum(POLICY_SCOPES),
  safeId: z.string().uuid().nullable().optional(),
  config: policyConfigSchema,
  subscriptionListId: z.string().uuid().nullable().optional(),
  enabled: z.boolean().optional(),
});

export async function GET() {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const policiesList = await getPoliciesByOrg(orgId);

  // Enrich with lastFired timestamps from policy_fire_logs
  const policyIds = policiesList.map((p) => p.id);
  const lastFiredMap = await getLastFiredForPolicies(policyIds);

  const enriched = policiesList.map((p) => ({
    ...p,
    lastFiredAt: lastFiredMap.get(p.id)?.toISOString() ?? null,
  }));

  return NextResponse.json({ policies: enriched });
}

export async function POST(req: NextRequest) {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId, user } = result;

  const parseResult = await parseRequestBody(req, createPolicySchema);
  if ("error" in parseResult) return parseResult.error;
  const { name, type, scope, safeId, config, subscriptionListId, enabled } = parseResult.data;

  if (scope === "safe" && !safeId) {
    return NextResponse.json({ error: "safeId required when scope is safe" }, { status: 400 });
  }

  const policy = await createPolicy({
    orgId,
    name,
    type: type ?? "custom",
    scope,
    safeId: safeId ?? null,
    config: config as Record<string, unknown>,
    subscriptionListId: subscriptionListId ?? null,
    enabled: enabled ?? true,
    createdByUserId: user.id,
  });
  if (!policy) return NextResponse.json({ error: "Failed to create policy" }, { status: 500 });

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
