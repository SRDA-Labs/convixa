import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { alertRules, safes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuthOrgPermission, parseRequestBody, safeJsonParse } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import { ALERT_TYPES, validateConfig } from "@/lib/alert-validation";

const updateRuleSchema = z.object({
  type: z.enum(ALERT_TYPES).optional(),
  safeId: z.string().uuid().nullable().optional(),
  subscriptionListId: z.string().uuid().nullable().optional(),
  name: z.string().max(200).optional(),
  config: z.record(z.unknown()).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const { id } = await params;
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });
  const ruleId = idParsed.data;
  const [existing] = await db.select().from(alertRules).where(eq(alertRules.id, ruleId)).limit(1);
  if (!existing || existing.orgId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parseResult = await parseRequestBody(req, updateRuleSchema);
  if ("error" in parseResult) return parseResult.error;
  const parsed = parseResult.data;

  const type = parsed.type ?? existing.type;
  const config = parsed.config ?? safeJsonParse(existing.config, {});
  const configCheck = validateConfig(type, config);
  if (!configCheck.valid) return NextResponse.json({ error: configCheck.error }, { status: 400 });

  const safeId = parsed.safeId !== undefined ? parsed.safeId : existing.safeId;
  if (safeId) {
    const [safe] = await db.select({ id: safes.id, orgId: safes.orgId }).from(safes).where(eq(safes.id, safeId)).limit(1);
    if (!safe || safe.orgId !== orgId) return NextResponse.json({ error: "Safe not found or not in this org" }, { status: 404 });
  }

  const { getSubscriptionListById } = await import("@/lib/db/repositories/subscription-lists.repository");
  const subscriptionListId = parsed.subscriptionListId !== undefined ? parsed.subscriptionListId : existing.subscriptionListId;
  if (subscriptionListId) {
    const list = await getSubscriptionListById(subscriptionListId);
    if (!list || list.organizationId !== orgId) return NextResponse.json({ error: "Subscription list not found or not in this org" }, { status: 404 });
  }

  const [rule] = await db
    .update(alertRules)
    .set({
      safeId: safeId ?? null,
      subscriptionListId: subscriptionListId ?? null,
      type,
      config: config,
      name: parsed.name !== undefined ? parsed.name : existing.name,
    })
    .where(eq(alertRules.id, ruleId))
    .returning();

  if (!rule) return NextResponse.json({ error: "Update failed" }, { status: 500 });

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
  const ruleId = idParsed.data;
  const [existing] = await db.select().from(alertRules).where(eq(alertRules.id, ruleId)).limit(1);
  if (!existing || existing.orgId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(alertRules).where(eq(alertRules.id, ruleId));
  return NextResponse.json({ ok: true });
}
