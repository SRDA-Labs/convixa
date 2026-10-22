import { computeOrgReadiness } from "@/lib/readiness/compute-readiness";
import {
  countSafesWithDelays,
  countStrictSafesWithTwins,
  countActiveWebhooks,
  countPendingWithoutSimulation,
  getLatestCertificationExport,
  getWebhookSubscriptionsByOrg,
} from "@/lib/db/repositories/governance.repository";
import { buildOrgPolicyGapReport } from "@/lib/policy-gap/build-report";
import { db } from "@/lib/db";
import { safes } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export type GovernanceMetrics = {
  computedAt: string;
  readinessScore: number;
  timelockCoveragePct: number;
  twinCoveragePct: number;
  activeWebhooks: number;
  criticalPolicyGaps: number;
  pendingWithoutSimulation: number;
  daysSinceCertificationExport: number | null;
  webhookHealth: Array<{
    id: string;
    safeAddress: string;
    network: string;
    status: string;
    lastReceivedAt: string | null;
    stale: boolean;
  }>;
  topPolicyGaps: Array<{
    safeId: string;
    safeName: string | null;
    gapId: string;
    severity: string;
    message: string;
  }>;
};

export async function computeOrgGovernance(orgId: string): Promise<GovernanceMetrics> {
  const [readiness, strictSafes, delaysCount, twins, webhooks, pendingSim, lastExport, gapReport, subs] =
    await Promise.all([
      computeOrgReadiness(orgId),
      db
        .select({ id: safes.id })
        .from(safes)
        .where(
          and(
            eq(safes.orgId, orgId),
            inArray(safes.classification, ["treasury", "protocol_critical"])
          )
        ),
      countSafesWithDelays(orgId),
      countStrictSafesWithTwins(orgId),
      countActiveWebhooks(orgId),
      countPendingWithoutSimulation(orgId),
      getLatestCertificationExport(orgId),
      buildOrgPolicyGapReport(orgId),
      getWebhookSubscriptionsByOrg(orgId),
    ]);

  const strictTotal = strictSafes.length;
  const timelockPct =
    strictTotal > 0 ? Math.round((delaysCount / strictTotal) * 100) : 100;
  const twinPct =
    twins.strictTotal > 0
      ? Math.round((twins.withTwin / twins.strictTotal) * 100)
      : 100;

  const criticalGaps = gapReport.gaps.filter((g) => g.severity === "critical").length;

  let daysSinceExport: number | null = null;
  if (lastExport?.createdAt) {
    daysSinceExport = Math.floor(
      (Date.now() - lastExport.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  const now = Date.now();
  const staleThresholdMs = 24 * 60 * 60 * 1000;

  return {
    computedAt: new Date().toISOString(),
    readinessScore: readiness.overallScore,
    timelockCoveragePct: timelockPct,
    twinCoveragePct: twinPct,
    activeWebhooks: webhooks,
    criticalPolicyGaps: criticalGaps,
    pendingWithoutSimulation: pendingSim,
    daysSinceCertificationExport: daysSinceExport,
    webhookHealth: subs.map((s) => ({
      id: s.id,
      safeAddress: s.safeAddress,
      network: s.network,
      status: s.status,
      lastReceivedAt: s.lastReceivedAt?.toISOString() ?? null,
      stale:
        s.status === "active" &&
        (!s.lastReceivedAt || now - s.lastReceivedAt.getTime() > staleThresholdMs),
    })),
    topPolicyGaps: gapReport.gaps
      .filter((g) => g.severity !== "info")
      .slice(0, 10)
      .map((g) => ({
        safeId: g.safeId,
        safeName: g.safeName,
        gapId: g.id,
        severity: g.severity,
        message: g.message,
      })),
  };
}
