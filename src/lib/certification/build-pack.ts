import { computeOrgReadiness } from "@/lib/readiness/compute-readiness";
import { computeOrgGovernance } from "@/lib/governance/compute-governance";
import { buildOrgPolicyGapReport } from "@/lib/policy-gap/build-report";
import {
  getOnboardingProgressByOrg,
  getDrillRunsByOrg,
  getPlaybooksByOrg,
} from "@/lib/db/repositories/readiness.repository";
import {
  getDelayAttachmentsByOrg,
  getEnvironmentPairsByOrg,
} from "@/lib/db/repositories/governance.repository";
import { getRostersForExport } from "@/lib/db/repositories/safe-signer-roster.repository";
import { getPolicyFireLogsByOrg } from "@/lib/db/repositories/policy-fire-log.repository";
import { getPoliciesByOrg } from "@/lib/db/repositories/policies.repository";
import { db } from "@/lib/db";
import { safeConfigEvents, safes, auditLogs } from "@/lib/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { evaluateComplianceFromSnapshot } from "@/lib/seal-compliance/evaluate";
import { getSafesWithSnapshots } from "@/lib/db/repositories/governance.repository";
import { getOperationalComplianceSlice } from "@/lib/operational-workflows/metrics";
import { getReadinessComplianceSlice } from "@/lib/readiness/compliance-slice";
import { getGovernanceComplianceSlice } from "@/lib/governance/compliance-slice";
import { buildSafePolicyGapReport } from "@/lib/policy-gap/build-report";
import { rosterRowsToComplianceEntries } from "@/lib/seal-compliance/evaluate";

export const CERTIFICATION_SCHEMA_VERSION = "seal-pack-v1";

export type CertificationPack = {
  manifest: {
    schemaVersion: string;
    exportedAt: string;
    orgId: string;
    phaseCoverage: string[];
    sectionCount: number;
  };
  readinessSummary: Awaited<ReturnType<typeof computeOrgReadiness>>;
  governanceSummary: Awaited<ReturnType<typeof computeOrgGovernance>>;
  policyGapReport: Awaited<ReturnType<typeof buildOrgPolicyGapReport>>;
  complianceScorecards: Array<{
    safeId: string;
    safeName: string | null;
    address: string;
    classification: string | null;
    pass: number;
    warn: number;
    fail: number;
    ruleIds: string[];
  }>;
  signerRoster: Awaited<ReturnType<typeof getRostersForExport>>;
  policyFireLog: Awaited<ReturnType<typeof getPolicyFireLogsByOrg>>;
  onboardingProgress: Awaited<ReturnType<typeof getOnboardingProgressByOrg>>;
  drillHistory: Awaited<ReturnType<typeof getDrillRunsByOrg>>;
  playbooks: Awaited<ReturnType<typeof getPlaybooksByOrg>>;
  delayAttachments: Awaited<ReturnType<typeof getDelayAttachmentsByOrg>>;
  testnetTwins: Awaited<ReturnType<typeof getEnvironmentPairsByOrg>>;
  policies: Awaited<ReturnType<typeof getPoliciesByOrg>>;
  configChangeLog: Array<Record<string, unknown>>;
  auditLogExcerpt: Array<Record<string, unknown>>;
};

export async function buildCertificationPack(orgId: string): Promise<CertificationPack> {
  const exportedAt = new Date().toISOString();

  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [
    readinessSummary,
    governanceSummary,
    policyGapReport,
    onboardingProgress,
    drillHistory,
    playbooks,
    delayAttachments,
    testnetTwins,
    policies,
    signerRoster,
    safeRows,
    policyFireLog,
  ] = await Promise.all([
    computeOrgReadiness(orgId),
    computeOrgGovernance(orgId),
    buildOrgPolicyGapReport(orgId),
    getOnboardingProgressByOrg(orgId),
    getDrillRunsByOrg(orgId, 500),
    getPlaybooksByOrg(orgId),
    getDelayAttachmentsByOrg(orgId),
    getEnvironmentPairsByOrg(orgId),
    getPoliciesByOrg(orgId),
    getRostersForExport(orgId),
    getSafesWithSnapshots(orgId),
    getPolicyFireLogsByOrg(orgId, { limit: 1000 }),
  ]);

  const complianceScorecards = [];
  for (const row of safeRows) {
    const [operational, readiness, governance] = await Promise.all([
      getOperationalComplianceSlice(
        orgId,
        row.safe.id,
        row.safe.classification ?? null,
        row.safe.address,
        row.safe.network
      ),
      getReadinessComplianceSlice(orgId, row.safe.id),
      getGovernanceComplianceSlice(orgId, row.safe.id),
    ]);
    const policyGaps = await buildSafePolicyGapReport(orgId, row.safe.id);
    const roster = await import("@/lib/db/repositories/safe-signer-roster.repository").then(
      (m) => m.getRosterBySafeId(row.safe.id)
    );
    const summary = evaluateComplianceFromSnapshot({
      threshold: row.snapshot?.threshold ?? null,
      owners: row.snapshot?.owners ?? [],
      classification: row.safe.classification ?? null,
      purpose: row.safe.purpose ?? null,
      moduleExceptionNote: row.safe.moduleExceptionNote ?? null,
      modulesJson: row.snapshot?.modulesJson ?? null,
      balances: row.snapshot?.balances ?? null,
      roster: rosterRowsToComplianceEntries(roster),
      operational,
      readiness,
      governance,
      policyGaps,
    });
    complianceScorecards.push({
      safeId: row.safe.id,
      safeName: row.safe.name,
      address: row.safe.address,
      classification: row.safe.classification,
      pass: summary.pass,
      warn: summary.warn,
      fail: summary.fail,
      ruleIds: summary.results.map((r) => `${r.ruleId}:${r.status}`),
    });
  }

  const configRows = await db
    .select({
      event: safeConfigEvents,
      safeName: safes.name,
      safeAddress: safes.address,
    })
    .from(safeConfigEvents)
    .innerJoin(safes, eq(safeConfigEvents.safeId, safes.id))
    .where(and(eq(safes.orgId, orgId), gte(safeConfigEvents.createdAt, since90d)))
    .orderBy(desc(safeConfigEvents.createdAt))
    .limit(1000);

  const auditRows = await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.orgId, orgId), gte(auditLogs.createdAt, since90d)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(500);

  const pack: CertificationPack = {
    manifest: {
      schemaVersion: CERTIFICATION_SCHEMA_VERSION,
      exportedAt,
      orgId,
      phaseCoverage: ["phase1", "phase2", "phase3", "phase4", "phase5"],
      sectionCount: 14,
    },
    readinessSummary,
    governanceSummary,
    policyGapReport,
    complianceScorecards,
    signerRoster,
    onboardingProgress,
    drillHistory,
    playbooks,
    delayAttachments,
    testnetTwins,
    policies,
    policyFireLog,
    configChangeLog: configRows.map((r) => ({
      safeName: r.safeName,
      safeAddress: r.safeAddress,
      ...r.event,
    })),
    auditLogExcerpt: auditRows,
  };

  return pack;
}

export function packToCsvSections(pack: CertificationPack): string {
  const lines: string[] = ["section,key,value"];
  lines.push(`manifest,schema_version,${pack.manifest.schemaVersion}`);
  lines.push(`manifest,exported_at,${pack.manifest.exportedAt}`);
  lines.push(`summary,readiness_score,${pack.readinessSummary.overallScore}`);
  lines.push(`summary,timelock_coverage_pct,${pack.governanceSummary.timelockCoveragePct}`);
  lines.push(`summary,critical_policy_gaps,${pack.governanceSummary.criticalPolicyGaps}`);

  for (const s of pack.complianceScorecards) {
    lines.push(
      `scorecard,${s.safeName ?? s.address},pass=${s.pass},warn=${s.warn},fail=${s.fail}`
    );
  }
  for (const g of pack.policyGapReport.gaps) {
    lines.push(`policy_gap,${g.safeAddress},${g.severity},${g.message}`);
  }
  for (const d of pack.delayAttachments) {
    lines.push(`delay,${d.safeId},${d.attachmentType},${d.delaySeconds ?? ""}`);
  }

  return lines.join("\n");
}
