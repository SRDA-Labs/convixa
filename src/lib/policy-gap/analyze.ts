import type { SafeClassification } from "@/lib/seal-compliance/types";

export type PolicyGapSeverity = "info" | "warn" | "critical";

export type PolicyGapItem = {
  id: string;
  severity: PolicyGapSeverity;
  category: string;
  message: string;
  remediation: string;
};

export type PolicyGapInput = {
  classification: SafeClassification;
  hasBlocklistPolicy: boolean;
  hasAmountPolicy: boolean;
  hasChecklistTemplates: boolean;
  moduleCount: number;
  guardAddress: string | null;
  delayAttachmentCount: number;
  moduleExceptionNote: string | null;
};

export function analyzePolicyGaps(input: PolicyGapInput): PolicyGapItem[] {
  const gaps: PolicyGapItem[] = [];
  const isStrict =
    input.classification === "treasury" || input.classification === "protocol_critical";

  if (isStrict && input.delayAttachmentCount === 0) {
    gaps.push({
      id: "no_delay_module",
      severity: "critical",
      category: "Timelock",
      message: "No execution delay module detected",
      remediation: "Deploy a Zodiac Delay or timelock module, or document an exception.",
    });
  }

  if (isStrict && !input.hasChecklistTemplates) {
    gaps.push({
      id: "no_checklist_templates",
      severity: "warn",
      category: "Pre-sign",
      message: "No checklist templates configured",
      remediation: "Seed Convixa default checklist templates for pre-sign reviews.",
    });
  }

  if (input.hasBlocklistPolicy && input.moduleCount === 0 && !input.guardAddress) {
    gaps.push({
      id: "blocklist_offchain_only",
      severity: "warn",
      category: "Policy alignment",
      message: "Blocklist policy active but no on-chain guard/module",
      remediation: "Consider deploying an on-chain policy guard or document off-chain-only enforcement.",
    });
  }

  if (input.moduleCount > 0 && !input.moduleExceptionNote && isStrict) {
    gaps.push({
      id: "modules_undocumented",
      severity: "warn",
      category: "Modules",
      message: "Modules enabled without exception note on safe profile",
      remediation: "Add module justification in safe profile.",
    });
  }

  if (input.hasAmountPolicy && input.moduleCount === 0) {
    gaps.push({
      id: "amount_policy_offchain",
      severity: "info",
      category: "Policy alignment",
      message: "USD amount policies are off-chain only (expected for Convixa alerts)",
      remediation: "No action required unless on-chain enforcement is desired.",
    });
  }

  return gaps;
}

export function countCriticalGaps(gaps: PolicyGapItem[]): number {
  return gaps.filter((g) => g.severity === "critical").length;
}
