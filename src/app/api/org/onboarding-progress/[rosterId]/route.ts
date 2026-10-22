import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndOrg, parseRequestBody } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { safeSignerRoster } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { firstOrNull } from "@/lib/db/utils/queries";
import {
  ensureOnboardingProgressForRoster,
  upsertOnboardingProgress,
  getOnboardingTemplatesByOrg,
} from "@/lib/db/repositories/readiness.repository";
import {
  evaluateOnboardingAutoRule,
  isOnboardingComplete,
} from "@/lib/readiness/evaluate-onboarding";
import { hasCompletedDrillType } from "@/lib/db/repositories/readiness.repository";

const patchSchema = z.object({
  itemsStateJson: z.record(
    z.string(),
    z.object({
      completed: z.boolean(),
      autoResult: z.boolean().optional(),
      note: z.string().optional(),
      completedAt: z.string().optional(),
    })
  ),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ rosterId: string }> }
) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  const { rosterId } = await params;
  const roster = await db
    .select()
    .from(safeSignerRoster)
    .where(eq(safeSignerRoster.id, rosterId))
    .limit(1)
    .then(firstOrNull);

  if (!roster || roster.orgId !== auth.orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!(await hasPermission("security:manage", auth.orgId))) {
    return NextResponse.json({ error: "Security manage permission required" }, { status: 403 });
  }

  const body = await parseRequestBody(req, patchSchema);
  if ("error" in body) return body.error;

  await ensureOnboardingProgressForRoster(auth.orgId, rosterId);
  const templates = await getOnboardingTemplatesByOrg(auth.orgId);
  const defaultTemplate = templates.find((t) => t.isDefault) ?? templates[0];
  const items = defaultTemplate?.itemsJson ?? [];

  const hasTestnetDrill = await hasCompletedDrillType(
    auth.orgId,
    "testnet_sign",
    365
  );

  const mergedState = { ...body.data.itemsStateJson };
  for (const item of items) {
    if (item.type !== "auto" || !item.autoRule) continue;
    const evalResult = await evaluateOnboardingAutoRule(item.autoRule, {
      verificationStatus: roster.verificationStatus,
      hasTestnetDrill,
    });
    if (evalResult.applicable && evalResult.pass) {
      mergedState[item.id] = {
        completed: true,
        autoResult: true,
        completedAt: new Date().toISOString(),
      };
    }
  }

  const complete = isOnboardingComplete(items, mergedState);
  const progress = await upsertOnboardingProgress({
    rosterId,
    orgId: auth.orgId,
    itemsStateJson: mergedState,
    status: complete ? "completed" : "in_progress",
    completedByUserId: complete ? auth.userId : null,
  });

  return NextResponse.json({ progress });
}
