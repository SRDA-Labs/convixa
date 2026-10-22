import type { ComplianceInput, ComplianceResult } from "./types";

function isStrict(classification: ComplianceInput["classification"]): boolean {
  return classification === "treasury" || classification === "protocol_critical";
}

export function ruleTimelockPresent(input: ComplianceInput): ComplianceResult {
  const g = input.governance;
  if (!isStrict(input.classification)) {
    return {
      ruleId: "timelock_present",
      status: "pass",
      message: "Timelock recommended for treasury/protocol safes",
      remediation: "",
      sealRef: "governance",
    };
  }

  const count = g?.delayAttachmentCount ?? 0;
  if (count > 0) {
    return {
      ruleId: "timelock_present",
      status: "pass",
      message: `${count} delay module(s) detected`,
      remediation: "",
      sealRef: "governance",
    };
  }

  return {
    ruleId: "timelock_present",
    status: "fail",
    message: "No execution delay module detected",
    remediation: "Deploy a Zodiac Delay or timelock module, or document an exception.",
    sealRef: "governance",
  };
}

export function ruleTimelockMeetsMinimum(input: ComplianceInput): ComplianceResult {
  const g = input.governance;
  if (input.classification !== "protocol_critical") {
    return {
      ruleId: "timelock_meets_minimum",
      status: "pass",
      message: "Minimum delay enforced for protocol-critical safes",
      remediation: "",
      sealRef: "governance",
    };
  }

  const maxDelay = g?.maxDelaySeconds ?? 0;
  const minRequired = g?.minDelaySecondsProtocol ?? 172800;

  if (maxDelay >= minRequired) {
    return {
      ruleId: "timelock_meets_minimum",
      status: "pass",
      message: `Delay meets minimum (${maxDelay}s)`,
      remediation: "",
      sealRef: "governance",
    };
  }

  if ((g?.delayAttachmentCount ?? 0) === 0) {
    return {
      ruleId: "timelock_meets_minimum",
      status: "fail",
      message: "No delay module for protocol-critical safe",
      remediation: "Add timelock module meeting org minimum delay.",
      sealRef: "governance",
    };
  }

  return {
    ruleId: "timelock_meets_minimum",
    status: "warn",
    message: `Delay may be below org minimum (${minRequired}s)`,
    remediation: "Verify module delay configuration on-chain.",
    sealRef: "governance",
  };
}

export function ruleTestnetTwinConfigured(input: ComplianceInput): ComplianceResult {
  const g = input.governance;
  if (!isStrict(input.classification)) {
    return {
      ruleId: "testnet_twin_configured",
      status: "pass",
      message: "Testnet twin recommended for treasury/protocol",
      remediation: "",
      sealRef: "governance",
    };
  }

  if (g?.hasTestnetTwin) {
    return {
      ruleId: "testnet_twin_configured",
      status: "pass",
      message: "Testnet twin linked",
      remediation: "",
      sealRef: "governance",
    };
  }

  return {
    ruleId: "testnet_twin_configured",
    status: "warn",
    message: "No testnet twin configured",
    remediation: "Link a testnet twin Safe in inventory for staging practice.",
    sealRef: "governance",
  };
}

export function ruleTestnetTwinInSync(input: ComplianceInput): ComplianceResult {
  const g = input.governance;
  if (!g?.hasTestnetTwin || !isStrict(input.classification)) {
    return {
      ruleId: "testnet_twin_in_sync",
      status: "pass",
      message: "Twin sync applies when twin is linked",
      remediation: "",
      sealRef: "governance",
    };
  }

  if (g.twinInSync) {
    return {
      ruleId: "testnet_twin_in_sync",
      status: "pass",
      message: "Testnet twin threshold/owners in sync",
      remediation: "",
      sealRef: "governance",
    };
  }

  return {
    ruleId: "testnet_twin_in_sync",
    status: "warn",
    message: "Testnet twin drift detected",
    remediation: "Reconcile owners/threshold or update twin link.",
    sealRef: "governance",
  };
}

export function rulePolicyGapCritical(input: ComplianceInput): ComplianceResult {
  const gaps = input.policyGaps ?? [];
  const critical = gaps.filter((g) => g.severity === "critical");
  if (!isStrict(input.classification)) {
    return {
      ruleId: "policy_gap_critical",
      status: "pass",
      message: "Policy gap review for treasury/protocol",
      remediation: "",
      sealRef: "governance",
    };
  }

  if (critical.length === 0) {
    return {
      ruleId: "policy_gap_critical",
      status: "pass",
      message: "No critical policy gaps",
      remediation: "",
      sealRef: "governance",
    };
  }

  return {
    ruleId: "policy_gap_critical",
    status: "fail",
    message: `${critical.length} critical policy gap(s)`,
    remediation: "Review policies and on-chain guards on each Safe's detail page.",
    sealRef: "governance",
  };
}

export function ruleCertificationCurrent(input: ComplianceInput): ComplianceResult {
  const days = input.governance?.daysSinceCertificationExport;
  if (days == null) {
    return {
      ruleId: "certification_pack_current",
      status: "warn",
      message: "No SEAL certification export on record",
      remediation: "Generate certification pack in Security → Certification.",
      sealRef: "governance",
    };
  }

  if (days <= 90) {
    return {
      ruleId: "certification_pack_current",
      status: "pass",
      message: `Certification exported ${days} day(s) ago`,
      remediation: "",
      sealRef: "governance",
    };
  }

  return {
    ruleId: "certification_pack_current",
    status: "warn",
    message: `Last certification export ${days} days ago`,
    remediation: "Regenerate SEAL certification pack (recommended every 90 days).",
    sealRef: "governance",
  };
}

export const PHASE5_RULES = [
  ruleTimelockPresent,
  ruleTimelockMeetsMinimum,
  ruleTestnetTwinConfigured,
  ruleTestnetTwinInSync,
  rulePolicyGapCritical,
  ruleCertificationCurrent,
] as const;
