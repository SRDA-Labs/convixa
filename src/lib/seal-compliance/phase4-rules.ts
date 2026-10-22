import type { ComplianceInput, ComplianceResult } from "./types";

function isStrict(classification: ComplianceInput["classification"]): boolean {
  return classification === "treasury" || classification === "protocol_critical";
}

export function ruleOnboardingComplete(input: ComplianceInput): ComplianceResult {
  const r = input.readiness;
  if (!isStrict(input.classification)) {
    return {
      ruleId: "signer_onboarding_complete",
      status: "pass",
      message: "Onboarding completion tracked for treasury/protocol safes",
      remediation: "",
      sealRef: "readiness",
    };
  }

  const pct = r?.onboardingCompletionPct ?? 100;
  if (pct === 100) {
    return {
      ruleId: "signer_onboarding_complete",
      status: "pass",
      message: "All active signers completed onboarding",
      remediation: "",
      sealRef: "readiness",
    };
  }

  const status = pct < 50 ? "fail" : "warn";
  return {
    ruleId: "signer_onboarding_complete",
    status,
    message: `${pct}% of signers completed onboarding for this safe`,
    remediation: "Complete signer onboarding checklists in Security → Onboarding.",
    sealRef: "readiness",
  };
}

export function ruleDrillCurrent(input: ComplianceInput): ComplianceResult {
  const r = input.readiness;
  if (input.classification !== "protocol_critical") {
    return {
      ruleId: "readiness_drill_current",
      status: "pass",
      message: "Drill cadence required for protocol-critical safes",
      remediation: "",
      sealRef: "readiness",
    };
  }

  const overdue = r?.overdueDrills ?? 0;
  const recent = r?.drillCompletedWithin90d ?? false;

  if (overdue > 0) {
    return {
      ruleId: "readiness_drill_current",
      status: "fail",
      message: `${overdue} overdue emergency drill(s)`,
      remediation: "Schedule and complete emergency drills in Security → Drills.",
      sealRef: "readiness",
    };
  }

  if (!recent) {
    return {
      ruleId: "readiness_drill_current",
      status: "warn",
      message: "No completed drill in the last 90 days",
      remediation: "Log a completed drill or run a tabletop exercise.",
      sealRef: "readiness",
    };
  }

  return {
    ruleId: "readiness_drill_current",
    status: "pass",
    message: "Emergency drills current",
    remediation: "",
    sealRef: "readiness",
  };
}

export function rulePlaybooksPublished(input: ComplianceInput): ComplianceResult {
  const r = input.readiness;
  if (!isStrict(input.classification)) {
    return {
      ruleId: "readiness_playbooks_current",
      status: "pass",
      message: "DR playbooks recommended for treasury/protocol orgs",
      remediation: "",
      sealRef: "readiness",
    };
  }

  const published = r?.playbookScenariosPublished ?? 0;
  const expected = r?.playbookScenariosExpected ?? 5;

  if (published >= expected) {
    const stale = r?.stalePlaybooks ?? 0;
    if (stale > 0) {
      return {
        ruleId: "readiness_playbooks_current",
        status: "warn",
        message: `${stale} playbook(s) not reviewed in 12+ months`,
        remediation: "Review and republish disaster recovery playbooks.",
        sealRef: "readiness",
      };
    }
    return {
      ruleId: "readiness_playbooks_current",
      status: "pass",
      message: "All DR playbook scenarios published",
      remediation: "",
      sealRef: "readiness",
    };
  }

  return {
    ruleId: "readiness_playbooks_current",
    status: "warn",
    message: `${published}/${expected} DR playbook scenarios published`,
    remediation: "Publish disaster recovery playbooks in Security → Playbooks.",
    sealRef: "readiness",
  };
}

export function ruleOnboardingTemplateConfigured(input: ComplianceInput): ComplianceResult {
  const r = input.readiness;
  if (!isStrict(input.classification)) {
    return {
      ruleId: "onboarding_template_configured",
      status: "pass",
      message: "Onboarding templates apply to treasury/protocol orgs",
      remediation: "",
      sealRef: "readiness",
    };
  }

  const count = r?.onboardingTemplatesCount ?? 0;
  if (count > 0) {
    return {
      ruleId: "onboarding_template_configured",
      status: "pass",
      message: "Signer onboarding template configured",
      remediation: "",
      sealRef: "readiness",
    };
  }

  return {
    ruleId: "onboarding_template_configured",
    status: "warn",
    message: "No signer onboarding template",
    remediation: "Seed Convixa default onboarding template.",
    sealRef: "readiness",
  };
}

export const PHASE4_RULES = [
  ruleOnboardingTemplateConfigured,
  ruleOnboardingComplete,
  ruleDrillCurrent,
  rulePlaybooksPublished,
] as const;
