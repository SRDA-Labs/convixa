import { analyzePolicyGaps, type PolicyGapItem } from "./analyze";
import { getSafesWithSnapshots, getDelayAttachmentsBySafe } from "@/lib/db/repositories/governance.repository";
import { getPoliciesByOrg } from "@/lib/db/repositories/policies.repository";
import { countOnboardingTemplates } from "@/lib/db/repositories/readiness.repository";
import { getOperationalComplianceSlice } from "@/lib/operational-workflows/metrics";
import type { SafeClassification } from "@/lib/seal-compliance/types";

export type SafePolicyGap = PolicyGapItem & {
  safeId: string;
  safeName: string | null;
  safeAddress: string;
};

export type OrgPolicyGapReport = {
  computedAt: string;
  safeCount: number;
  gaps: SafePolicyGap[];
  criticalCount: number;
  warnCount: number;
};

export async function buildSafePolicyGapReport(
  orgId: string,
  safeId: string
): Promise<SafePolicyGap[]> {
  const rows = await getSafesWithSnapshots(orgId);
  const row = rows.find((r) => r.safe.id === safeId);
  if (!row) return [];

  const policies = await getPoliciesByOrg(orgId);
  const safePolicies = policies.filter(
    (p) => p.enabled && (p.scope === "org" || p.safeId === safeId)
  );
  const hasBlocklist = safePolicies.some((p) => p.type === "blocklist");
  const hasAmount = safePolicies.some((p) => p.type === "amount_threshold");
  const templates = await countOnboardingTemplates(orgId);
  const delays = await getDelayAttachmentsBySafe(safeId);
  const modules = Array.isArray(row.snapshot?.modulesJson)
    ? (row.snapshot.modulesJson as unknown[])
    : [];

  const gaps = analyzePolicyGaps({
    classification: (row.safe.classification as SafeClassification) ?? null,
    hasBlocklistPolicy: hasBlocklist,
    hasAmountPolicy: hasAmount,
    hasChecklistTemplates: templates > 0,
    moduleCount: modules.length,
    guardAddress: row.snapshot?.guardAddress ?? null,
    delayAttachmentCount: delays.length,
    moduleExceptionNote: row.safe.moduleExceptionNote ?? null,
  });

  return gaps.map((g) => ({
    ...g,
    safeId: row.safe.id,
    safeName: row.safe.name,
    safeAddress: row.safe.address,
  }));
}

export async function buildOrgPolicyGapReport(orgId: string): Promise<OrgPolicyGapReport> {
  const rows = await getSafesWithSnapshots(orgId);
  const policies = await getPoliciesByOrg(orgId);
  const templates = await countOnboardingTemplates(orgId);
  const allGaps: SafePolicyGap[] = [];

  for (const row of rows) {
    const safeId = row.safe.id;
    const safePolicies = policies.filter(
      (p) => p.enabled && (p.scope === "org" || p.safeId === safeId)
    );
    const hasBlocklist = safePolicies.some((p) => p.type === "blocklist");
    const hasAmount = safePolicies.some((p) => p.type === "amount_threshold");
    const delays = await getDelayAttachmentsBySafe(safeId);
    const modules = Array.isArray(row.snapshot?.modulesJson)
      ? (row.snapshot.modulesJson as unknown[])
      : [];

    const gaps = analyzePolicyGaps({
      classification: (row.safe.classification as SafeClassification) ?? null,
      hasBlocklistPolicy: hasBlocklist,
      hasAmountPolicy: hasAmount,
      hasChecklistTemplates: templates > 0,
      moduleCount: modules.length,
      guardAddress: row.snapshot?.guardAddress ?? null,
      delayAttachmentCount: delays.length,
      moduleExceptionNote: row.safe.moduleExceptionNote ?? null,
    });

    allGaps.push(
      ...gaps.map((g) => ({
        ...g,
        safeId,
        safeName: row.safe.name,
        safeAddress: row.safe.address,
      }))
    );
  }

  return {
    computedAt: new Date().toISOString(),
    safeCount: rows.length,
    gaps: allGaps,
    criticalCount: allGaps.filter((g) => g.severity === "critical").length,
    warnCount: allGaps.filter((g) => g.severity === "warn").length,
  };
}
