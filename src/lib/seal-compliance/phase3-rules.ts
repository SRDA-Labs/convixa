import type { ComplianceInput, ComplianceResult } from "./types";

function isStrict(classification: ComplianceInput["classification"]): boolean {
  return classification === "treasury" || classification === "protocol_critical";
}

export function ruleChecklistTemplateConfigured(input: ComplianceInput): ComplianceResult {
  const op = input.operational;
  if (!isStrict(input.classification)) {
    return {
      ruleId: "checklist_template_configured",
      status: "pass",
      message: "Checklist templates required for treasury/protocol safes",
      remediation: "",
      sealRef: "operational-workflows",
    };
  }

  const count = op?.checklistTemplatesCount ?? 0;
  if (count > 0) {
    return {
      ruleId: "checklist_template_configured",
      status: "pass",
      message: `${count} checklist template(s) available`,
      remediation: "",
      sealRef: "operational-workflows",
    };
  }

  return {
    ruleId: "checklist_template_configured",
    status: "warn",
    message: "No checklist templates configured",
    remediation: "Seed or create SEAL checklist templates for pre-sign reviews.",
    sealRef: "operational-workflows",
  };
}

export function rulePendingReviewsCurrent(input: ComplianceInput): ComplianceResult {
  const op = input.operational;
  if (!isStrict(input.classification)) {
    return {
      ruleId: "pending_reviews_current",
      status: "pass",
      message: "Pending review SLA applies to treasury/protocol safes",
      remediation: "",
      sealRef: "operational-workflows",
    };
  }

  const missing = op?.pendingTxsWithoutReview ?? 0;
  if (missing === 0) {
    return {
      ruleId: "pending_reviews_current",
      status: "pass",
      message: "All pending txs have signer reviews",
      remediation: "",
      sealRef: "operational-workflows",
    };
  }

  return {
    ruleId: "pending_reviews_current",
    status: "warn",
    message: `${missing} pending tx(s) without completed reviews`,
    remediation: "Complete pre-sign checklists in Signer Queue before signing.",
    sealRef: "operational-workflows",
  };
}

export function ruleOobCaseOpenForGovernance(input: ComplianceInput): ComplianceResult {
  const op = input.operational;
  if (!isStrict(input.classification)) {
    return {
      ruleId: "oob_case_open_for_governance",
      status: "pass",
      message: "OOB verification applies to treasury/protocol safes",
      remediation: "",
      sealRef: "operational-workflows",
    };
  }

  const proposed = op?.proposedGovernanceWithoutOob ?? 0;
  if (proposed === 0) {
    return {
      ruleId: "oob_case_open_for_governance",
      status: "pass",
      message: "No critical governance proposals missing OOB case",
      remediation: "",
      sealRef: "operational-workflows",
    };
  }

  return {
    ruleId: "oob_case_open_for_governance",
    status: "warn",
    message: `${proposed} governance proposal(s) without OOB verification case`,
    remediation: "Open an out-of-band verification case before signing admin changes.",
    sealRef: "operational-workflows",
  };
}

export function ruleOobVerificationComplete(input: ComplianceInput): ComplianceResult {
  const op = input.operational;
  if (!isStrict(input.classification)) {
    return {
      ruleId: "oob_verification_complete",
      status: "pass",
      message: "OOB completion rule applies to treasury/protocol safes",
      remediation: "",
      sealRef: "operational-workflows",
    };
  }

  const unverified = op?.unverifiedGovernanceEvents7d ?? 0;
  if (unverified === 0) {
    return {
      ruleId: "oob_verification_complete",
      status: "pass",
      message: "No unverified governance changes in last 7 days",
      remediation: "",
      sealRef: "operational-workflows",
    };
  }

  return {
    ruleId: "oob_verification_complete",
    status: "fail",
    message: `${unverified} governance change(s) without verified OOB case (7d)`,
    remediation: "Complete OOB verification before executing admin changes.",
    sealRef: "operational-workflows",
  };
}

export function ruleIncidentContactConfigured(input: ComplianceInput): ComplianceResult {
  const op = input.operational;
  if (!isStrict(input.classification)) {
    return {
      ruleId: "incident_contact_configured",
      status: "pass",
      message: "Security contact recommended for treasury/protocol orgs",
      remediation: "",
      sealRef: "operational-workflows",
    };
  }

  if (op?.hasSecurityContact) {
    return {
      ruleId: "incident_contact_configured",
      status: "pass",
      message: "Security contact email configured",
      remediation: "",
      sealRef: "operational-workflows",
    };
  }

  return {
    ruleId: "incident_contact_configured",
    status: "warn",
    message: "SECURITY_CONTACT_EMAIL not set",
    remediation: "Set SECURITY_CONTACT_EMAIL for incident reporting notifications.",
    sealRef: "operational-workflows",
  };
}

export const PHASE3_RULES = [
  ruleChecklistTemplateConfigured,
  rulePendingReviewsCurrent,
  ruleOobCaseOpenForGovernance,
  ruleOobVerificationComplete,
  ruleIncidentContactConfigured,
] as const;
