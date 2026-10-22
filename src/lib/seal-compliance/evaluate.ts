import {
  inferClassificationFromUsd,
  getRecommendedConfig,
  estimateUsdFromSnapshotBalances,
} from "./classification";
import { ALL_RULES } from "./rules";
import { PHASE2_RULES } from "./phase2-rules";
import { PHASE3_RULES } from "./phase3-rules";
import { PHASE4_RULES } from "./phase4-rules";
import { PHASE5_RULES } from "./phase5-rules";
import type { ComplianceInput, ComplianceSummary, SafeClassification } from "./types";

export function buildComplianceInput(params: {
  threshold: number | null;
  owners: unknown;
  classification: string | null;
  purpose: string | null;
  moduleExceptionNote: string | null;
  modulesJson: unknown;
  balances: unknown;
}): ComplianceInput {
  const owners = Array.isArray(params.owners) ? params.owners : [];
  const modules = Array.isArray(params.modulesJson) ? params.modulesJson : [];
  const estimatedUsd = estimateUsdFromSnapshotBalances(params.balances);
  const classification = (params.classification as SafeClassification) ?? null;

  return {
    threshold: params.threshold ?? 0,
    ownersCount: owners.length,
    classification: inferClassificationFromUsd(estimatedUsd, classification),
    purpose: params.purpose,
    moduleExceptionNote: params.moduleExceptionNote,
    modulesCount: modules.length,
    estimatedUsd,
  };
}

const ALL_COMPLIANCE_RULES = [
  ...ALL_RULES,
  ...PHASE2_RULES,
  ...PHASE3_RULES,
  ...PHASE4_RULES,
  ...PHASE5_RULES,
];

export function evaluateCompliance(input: ComplianceInput): ComplianceSummary {
  const results = ALL_COMPLIANCE_RULES.map((rule) => rule(input));
  const recommended = getRecommendedConfig(
    input.classification,
    input.estimatedUsd ?? 0
  );

  return {
    pass: results.filter((r) => r.status === "pass").length,
    warn: results.filter((r) => r.status === "warn").length,
    fail: results.filter((r) => r.status === "fail").length,
    results,
    recommendedThreshold: recommended.threshold,
    recommendedOwners: recommended.owners,
    inferredClassification: input.classification,
  };
}

export function evaluateComplianceFromSnapshot(params: {
  threshold: number | null;
  owners: unknown;
  classification: string | null;
  purpose: string | null;
  moduleExceptionNote: string | null;
  modulesJson: unknown;
  balances: unknown;
  roster?: ComplianceInput["roster"];
  operational?: ComplianceInput["operational"];
  readiness?: ComplianceInput["readiness"];
  governance?: ComplianceInput["governance"];
  policyGaps?: ComplianceInput["policyGaps"];
}): ComplianceSummary {
  const input = buildComplianceInput(params);
  if (params.roster) input.roster = params.roster;
  if (params.operational) input.operational = params.operational;
  if (params.readiness) input.readiness = params.readiness;
  if (params.governance) input.governance = params.governance;
  if (params.policyGaps) input.policyGaps = params.policyGaps;
  return evaluateCompliance(input);
}

export function rosterRowsToComplianceEntries(
  rows: Array<{
    signerAddress: string;
    signerType: string | null;
    roleLabel: string | null;
    verificationStatus: string;
    verificationMethod: string | null;
    hardwareWallet: string | null;
    isDedicatedSigner: boolean | null;
    removedAt: Date | null;
  }>
): ComplianceInput["roster"] {
  return rows.map((r) => ({
    signerAddress: r.signerAddress,
    signerType: r.signerType ?? "unknown",
    roleLabel: r.roleLabel,
    verificationStatus: r.verificationStatus,
    verificationMethod: r.verificationMethod,
    hardwareWallet: r.hardwareWallet,
    isDedicatedSigner: r.isDedicatedSigner,
    removedAt: r.removedAt,
  }));
}
