import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { safes, safeSignerRoster } from "@/lib/db/schema";
import {
  countOnboardingStats,
  countOverdueDrillSchedules,
  countPublishedPlaybookScenarios,
  countStalePlaybooks,
  getDrillSchedulesByOrg,
  getLastCompletedDrill,
  bootstrapOnboardingForOrg,
  seedDefaultDrillSchedulesForOrg,
  syncDefaultPlaybooks,
} from "@/lib/db/repositories/readiness.repository";
import {
  countOpenOobCases,
  countOverdueOobCases,
} from "@/lib/db/repositories/operational-workflows.repository";
import { getSecurityContactEmail } from "@/lib/operational-workflows/config";
import { isDrillDueSoon } from "./drill-scheduler";
import { CONVIXA_DEFAULT_PLAYBOOKS } from "./default-playbooks";

export type OrgReadinessMetrics = {
  computedAt: string;
  onboarding: {
    total: number;
    completed: number;
    inProgress: number;
    completionPct: number;
  };
  drills: {
    overdueCount: number;
    dueWithin30Days: number;
    lastCompletedAt: string | null;
    activeSchedules: number;
  };
  playbooks: {
    publishedScenarios: number;
    expectedScenarios: number;
    staleCount: number;
  };
  operational: {
    openOobCases: number;
    overdueOobCases: number;
    hasSecurityContact: boolean;
  };
  safes: {
    total: number;
    protocolCritical: number;
    treasury: number;
  };
  verification: {
    totalSigners: number;
    verifiedSigners: number;
    verificationPct: number;
  };
  overallScore: number;
};

export async function computeOrgReadiness(orgId: string): Promise<OrgReadinessMetrics> {
  await bootstrapOnboardingForOrg(orgId);
  await seedDefaultDrillSchedulesForOrg(orgId);
  await syncDefaultPlaybooks(orgId);

  const [
    onboardingStats,
    overdueDrills,
    schedules,
    lastDrill,
    playbookCount,
    stalePlaybooks,
    openOob,
    overdueOob,
    safeRows,
    rosterRows,
  ] = await Promise.all([
    countOnboardingStats(orgId),
    countOverdueDrillSchedules(orgId),
    getDrillSchedulesByOrg(orgId),
    getLastCompletedDrill(orgId),
    countPublishedPlaybookScenarios(orgId),
    countStalePlaybooks(orgId),
    countOpenOobCases(orgId),
    countOverdueOobCases(orgId),
    db
      .select({
        classification: safes.classification,
      })
      .from(safes)
      .where(eq(safes.orgId, orgId)),
    db
      .select({
        verificationStatus: safeSignerRoster.verificationStatus,
      })
      .from(safeSignerRoster)
      .where(and(eq(safeSignerRoster.orgId, orgId), isNull(safeSignerRoster.removedAt))),
  ]);

  const activeSchedules = schedules.filter((s) => s.schedule.isActive);
  const dueWithin30 = activeSchedules.filter((s) =>
    isDrillDueSoon(s.schedule.nextDueAt, 30)
  ).length;

  const onboardingPct =
    onboardingStats.total > 0
      ? Math.round((onboardingStats.completed / onboardingStats.total) * 100)
      : 100;

  const verifiedCount = rosterRows.filter((r) => r.verificationStatus === "verified").length;
  const verificationPct =
    rosterRows.length > 0
      ? Math.round((verifiedCount / rosterRows.length) * 100)
      : 100;

  const playbookPct = Math.round(
    (playbookCount / CONVIXA_DEFAULT_PLAYBOOKS.length) * 100
  );
  const drillPenalty = overdueDrills > 0 ? 15 : 0;
  const onboardingPenalty = onboardingPct < 100 ? Math.round((100 - onboardingPct) * 0.3) : 0;
  const verificationPenalty = verificationPct < 100 ? Math.round((100 - verificationPct) * 0.2) : 0;
  const oobPenalty = overdueOob > 0 ? 10 : 0;
  const stalePenalty = stalePlaybooks > 0 ? 5 : 0;

  const overallScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        playbookPct * 0.2 +
          onboardingPct * 0.25 +
          verificationPct * 0.25 +
          (overdueDrills === 0 ? 20 : 5) +
          (overdueOob === 0 ? 10 : 0) -
          drillPenalty -
          onboardingPenalty * 0.1 -
          verificationPenalty * 0.1 -
          oobPenalty -
          stalePenalty
      )
    )
  );

  return {
    computedAt: new Date().toISOString(),
    onboarding: {
      total: onboardingStats.total,
      completed: onboardingStats.completed,
      inProgress: onboardingStats.inProgress,
      completionPct: onboardingPct,
    },
    drills: {
      overdueCount: overdueDrills,
      dueWithin30Days: dueWithin30,
      lastCompletedAt: lastDrill?.completedAt?.toISOString() ?? null,
      activeSchedules: activeSchedules.length,
    },
    playbooks: {
      publishedScenarios: playbookCount,
      expectedScenarios: CONVIXA_DEFAULT_PLAYBOOKS.length,
      staleCount: stalePlaybooks,
    },
    operational: {
      openOobCases: openOob,
      overdueOobCases: overdueOob,
      hasSecurityContact: Boolean(getSecurityContactEmail()),
    },
    safes: {
      total: safeRows.length,
      protocolCritical: safeRows.filter((s) => s.classification === "protocol_critical").length,
      treasury: safeRows.filter((s) => s.classification === "treasury").length,
    },
    verification: {
      totalSigners: rosterRows.length,
      verifiedSigners: verifiedCount,
      verificationPct,
    },
    overallScore,
  };
}
