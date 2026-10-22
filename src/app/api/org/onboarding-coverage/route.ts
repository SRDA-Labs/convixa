import { NextResponse } from "next/server";
import { requireAuthAndOrg } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import {
  bootstrapOnboardingForOrg,
  getOnboardingProgressByOrg,
  getOnboardingTemplatesByOrg,
} from "@/lib/db/repositories/readiness.repository";
import {
  evaluateOnboardingAutoRule,
  isOnboardingComplete,
  onboardingCompletionPercent,
} from "@/lib/readiness/evaluate-onboarding";
import { hasCompletedDrillType } from "@/lib/db/repositories/readiness.repository";

export async function GET() {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:read", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await bootstrapOnboardingForOrg(auth.orgId);
  const [templates, rows] = await Promise.all([
    getOnboardingTemplatesByOrg(auth.orgId),
    getOnboardingProgressByOrg(auth.orgId),
  ]);

  const defaultTemplate = templates.find((t) => t.isDefault) ?? templates[0];
  const items = defaultTemplate?.itemsJson ?? [];

  const hasTestnetDrill = await hasCompletedDrillType(
    auth.orgId,
    "testnet_sign",
    365
  );

  const entries = await Promise.all(
    rows.map(async (row) => {
      const state = { ...(row.progress.itemsStateJson ?? {}) } as Record<
        string,
        { completed: boolean; autoResult?: boolean; note?: string; completedAt?: string }
      >;

      for (const item of items) {
        if (item.type !== "auto" || !item.autoRule) continue;
        const evalResult = await evaluateOnboardingAutoRule(item.autoRule, {
          verificationStatus: row.roster.verificationStatus,
          hasTestnetDrill,
        });
        if (evalResult.applicable && evalResult.pass) {
          state[item.id] = {
            completed: true,
            autoResult: true,
            completedAt: new Date().toISOString(),
          };
        }
      }

      const complete = isOnboardingComplete(items, state);
      const pct = onboardingCompletionPercent(items, state);

      return {
        progressId: row.progress.id,
        rosterId: row.roster.id,
        safeId: row.progress.safeId,
        safeName: row.safeName,
        safeAddress: row.safeAddress,
        classification: row.classification,
        signerAddress: row.roster.signerAddress,
        displayName: row.roster.displayName,
        verificationStatus: row.roster.verificationStatus,
        status: complete ? "completed" : row.progress.status,
        completionPct: pct,
        itemsState: state,
      };
    })
  );

  return NextResponse.json({
    template: defaultTemplate,
    entries,
  });
}
