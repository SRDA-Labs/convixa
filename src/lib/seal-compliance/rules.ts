import type { ComplianceInput, ComplianceResult } from "./types";

const HIGH_VALUE_USD = 1_000_000;

export function ruleMinSigners3(input: ComplianceInput): ComplianceResult {
  const { ownersCount, classification } = input;
  const needsStrict =
    classification === "treasury" || classification === "protocol_critical";

  if (ownersCount >= 3) {
    return {
      ruleId: "min_signers_3",
      status: "pass",
      message: `${ownersCount} signers (minimum 3 met)`,
      remediation: "",
      sealRef: "thresholds-configuration",
    };
  }

  return {
    ruleId: "min_signers_3",
    status: needsStrict ? "fail" : "warn",
    message: `Only ${ownersCount} signer(s); SEAL recommends minimum 3`,
    remediation: "Add owners to reach at least 3 signers before holding significant funds.",
    sealRef: "thresholds-configuration",
  };
}

export function ruleThreshold50Pct(input: ComplianceInput): ComplianceResult {
  const minRequired = Math.ceil(input.ownersCount / 2);
  if (input.threshold >= minRequired) {
    return {
      ruleId: "threshold_50pct",
      status: "pass",
      message: `Threshold ${input.threshold}/${input.ownersCount} meets ~50% rule`,
      remediation: "",
      sealRef: "thresholds-configuration",
    };
  }
  return {
    ruleId: "threshold_50pct",
    status: "fail",
    message: `Threshold ${input.threshold}/${input.ownersCount} below 50% (${minRequired} required)`,
    remediation: "Increase threshold to at least half of owner count.",
    sealRef: "thresholds-configuration",
  };
}

export function ruleNoNOfN(input: ComplianceInput): ComplianceResult {
  if (input.ownersCount === 0) {
    return {
      ruleId: "no_n_of_n",
      status: "warn",
      message: "No owners data available",
      remediation: "Refresh safe snapshot to load owners.",
      sealRef: "thresholds-configuration",
    };
  }
  if (input.threshold < input.ownersCount) {
    return {
      ruleId: "no_n_of_n",
      status: "pass",
      message: "Not using N-of-N (loss of one key does not lock funds)",
      remediation: "",
      sealRef: "thresholds-configuration",
    };
  }
  return {
    ruleId: "no_n_of_n",
    status: "fail",
    message: `N-of-N configuration (${input.threshold}-of-${input.ownersCount})`,
    remediation: "Lower threshold below owner count so a single lost key cannot permanently lock funds.",
    sealRef: "thresholds-configuration",
  };
}

export function ruleHighValue7Signers(input: ComplianceInput): ComplianceResult {
  const usd = input.estimatedUsd ?? 0;
  if (usd < HIGH_VALUE_USD) {
    return {
      ruleId: "high_value_7_signers",
      status: "pass",
      message: "Asset band below $1M threshold for 7-signer rule",
      remediation: "",
      sealRef: "thresholds-configuration",
    };
  }
  if (input.ownersCount >= 7) {
    return {
      ruleId: "high_value_7_signers",
      status: "pass",
      message: `${input.ownersCount} signers for high-value safe`,
      remediation: "",
      sealRef: "thresholds-configuration",
    };
  }
  return {
    ruleId: "high_value_7_signers",
    status: "warn",
    message: `Estimated $${Math.round(usd).toLocaleString()} but only ${input.ownersCount} signers (SEAL: 7+)`,
    remediation: "Add signers to reach 7+ for safes holding $1M+ equivalent.",
    sealRef: "thresholds-configuration",
  };
}

export function ruleModulesDocumented(input: ComplianceInput): ComplianceResult {
  if (input.modulesCount === 0) {
    return {
      ruleId: "modules_documented",
      status: "pass",
      message: "No enabled modules",
      remediation: "",
      sealRef: "modules-guards",
    };
  }
  if (input.moduleExceptionNote?.trim()) {
    return {
      ruleId: "modules_documented",
      status: "pass",
      message: "Module exception documented",
      remediation: "",
      sealRef: "modules-guards",
    };
  }
  return {
    ruleId: "modules_documented",
    status: "warn",
    message: `${input.modulesCount} module(s) enabled without documented justification`,
    remediation: "Add a module exception note explaining security review and purpose.",
    sealRef: "modules-guards",
  };
}

export function ruleClassificationSet(input: ComplianceInput): ComplianceResult {
  const usd = input.estimatedUsd ?? 0;
  const needsClass =
    usd >= 100_000 ||
    input.classification === "treasury" ||
    input.classification === "protocol_critical";

  if (!needsClass || input.classification) {
    return {
      ruleId: "classification_set",
      status: "pass",
      message: input.classification
        ? `Classification: ${input.classification}`
        : "Classification not required for this asset band",
      remediation: "",
      sealRef: "documentation",
    };
  }
  return {
    ruleId: "classification_set",
    status: "warn",
    message: "High-value safe missing classification",
    remediation: "Set classification and purpose in the safe profile.",
    sealRef: "documentation",
  };
}

export const ALL_RULES = [
  ruleMinSigners3,
  ruleThreshold50Pct,
  ruleNoNOfN,
  ruleHighValue7Signers,
  ruleModulesDocumented,
  ruleClassificationSet,
] as const;
