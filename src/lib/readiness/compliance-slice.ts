import {
  countOnboardingTemplates,
  countOverdueDrillSchedules,
  countPublishedPlaybookScenarios,
  countStalePlaybooks,
  hasCompletedDrillType,
  getOnboardingProgressByOrg,
} from "@/lib/db/repositories/readiness.repository";
import { CONVIXA_DEFAULT_PLAYBOOKS } from "./default-playbooks";
import { onboardingCompletionPercent } from "./evaluate-onboarding";
import type { ReadinessComplianceSlice } from "@/lib/seal-compliance/types";
import type { OnboardingItemDef } from "./onboarding-templates";

export async function getReadinessComplianceSlice(
  orgId: string,
  safeId?: string
): Promise<ReadinessComplianceSlice> {
  const [
    templatesCount,
    overdueDrills,
    playbookCount,
    stalePlaybooks,
    drill90d,
    progressRows,
  ] = await Promise.all([
    countOnboardingTemplates(orgId),
    countOverdueDrillSchedules(orgId),
    countPublishedPlaybookScenarios(orgId),
    countStalePlaybooks(orgId),
    hasCompletedDrillType(orgId, "tabletop", 90, safeId ?? null),
    getOnboardingProgressByOrg(orgId),
  ]);

  const safeProgress = safeId
    ? progressRows.filter((r) => r.progress.safeId === safeId)
    : progressRows;

  let totalPct = 100;
  if (safeProgress.length > 0) {
    const pcts = safeProgress.map((row) => {
      const items = (row.progress.itemsStateJson ?? {}) as Record<
        string,
        { completed: boolean }
      >;
      const templateItems: OnboardingItemDef[] = [
        { id: "hw_wallet_confirmed", label: "", type: "manual", required: true },
        { id: "affiliation_signed", label: "", type: "auto", required: true },
        { id: "operating_charter_read", label: "", type: "manual", required: true },
        { id: "comms_channel_joined", label: "", type: "manual", required: true },
        { id: "oob_process_understood", label: "", type: "manual", required: true },
      ];
      if (row.progress.status === "completed") return 100;
      return onboardingCompletionPercent(templateItems, items);
    });
    totalPct = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  }

  return {
    onboardingTemplatesCount: templatesCount,
    onboardingCompletionPct: totalPct,
    overdueDrills,
    drillCompletedWithin90d: drill90d,
    playbookScenariosPublished: playbookCount,
    playbookScenariosExpected: CONVIXA_DEFAULT_PLAYBOOKS.length,
    stalePlaybooks,
  };
}
