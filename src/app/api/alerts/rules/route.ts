import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requireOrg, requirePermission, parseRequestBody, safeJsonParse } from "@/lib/api-helpers";
import { ALERT_TYPES, validateConfig } from "@/lib/alert-validation";
import { createAlertRule, getAlertRulesByOrg } from "@/lib/db/repositories";
import { getSafeById } from "@/lib/db/repositories";
import { getOrgStatus } from "@/lib/auth-server";

const createRuleSchema = z.object({
  type: z.enum(ALERT_TYPES),
  safeId: z.string().uuid().nullable(),
  subscriptionListId: z.string().uuid().nullable().optional(),
  name: z.string().max(200).optional(),
  config: z.record(z.unknown()),
});

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const orgResult = await requireOrg();
  if (orgResult instanceof NextResponse) {
    return NextResponse.json({ rules: [] });
  }
  const { orgId } = orgResult;

  const permResult = await requirePermission("safes:read", orgId);
  if (permResult) return permResult;

  // Use repository to get alert rules
  const rules = await getAlertRulesByOrg(orgId);

  const parsed = rules.map((r) => ({
    ...r,
    config: safeJsonParse(r.config, {}),
  }));

  return NextResponse.json({ rules: parsed });
}

export async function POST(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const orgResult = await requireOrg();
  if (orgResult instanceof NextResponse) {
    return NextResponse.json({ error: "No org" }, { status: 400 });
  }
  const { orgId } = orgResult;

  const permResult = await requirePermission("safes:read", orgId);
  if (permResult) return permResult;

  const parseResult = await parseRequestBody(req, createRuleSchema);
  if ("error" in parseResult) return parseResult.error;
  const parsed = parseResult.data;

  // Create the rule

  const { type, safeId, subscriptionListId, name, config } = parsed;
  const configCheck = validateConfig(type, config);
  if (!configCheck.valid) {
    return NextResponse.json({ error: configCheck.error }, { status: 400 });
  }

  // Validate safe exists and belongs to org
  if (safeId) {
    const safe = await getSafeById(safeId);
    if (!safe || safe.orgId !== orgId) {
      return NextResponse.json({ error: "Safe not found or not in this org" }, { status: 404 });
    }
  }

  const { getSubscriptionListById } = await import("@/lib/db/repositories/subscription-lists.repository");
  if (subscriptionListId) {
    const list = await getSubscriptionListById(subscriptionListId);
    if (!list || list.organizationId !== orgId) {
      return NextResponse.json({ error: "Subscription list not found or not in this org" }, { status: 404 });
    }
  }

  // Use repository to create alert rule
  const rule = await createAlertRule({
    orgId,
    safeId: safeId ?? null,
    subscriptionListId: subscriptionListId ?? null,
    type,
    config: config,
    name: name ?? null,
    createdByUserId: authResult.userId,
  });

  if (!rule) return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });

  return NextResponse.json({
    rule: {
      id: rule.id,
      orgId: rule.orgId,
      safeId: rule.safeId,
      subscriptionListId: rule.subscriptionListId,
      type: rule.type,
      config: safeJsonParse(rule.config, {}),
      name: rule.name,
      createdAt: rule.createdAt,
    },
  });
}
