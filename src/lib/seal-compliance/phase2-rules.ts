import type { ComplianceInput, ComplianceResult, RosterEntry } from "./types";

function isStrictClassification(classification: ComplianceInput["classification"]): boolean {
  return classification === "treasury" || classification === "protocol_critical";
}

function activeRoster(roster: RosterEntry[] | undefined): RosterEntry[] {
  return (roster ?? []).filter((r) => !r.removedAt);
}

export function ruleExternalSignerPresent(input: ComplianceInput): ComplianceResult {
  const roster = activeRoster(input.roster);
  if (!isStrictClassification(input.classification)) {
    return {
      ruleId: "external_signer_present",
      status: "pass",
      message: "External signer rule applies to treasury/protocol safes only",
      remediation: "",
      sealRef: "signer-composition",
    };
  }

  const hasExternal = roster.some(
    (r) => r.signerType === "external_advisor" || r.signerType === "security_partner"
  );

  if (hasExternal) {
    return {
      ruleId: "external_signer_present",
      status: "pass",
      message: "At least one external advisor or security partner signer",
      remediation: "",
      sealRef: "signer-composition",
    };
  }

  return {
    ruleId: "external_signer_present",
    status: "fail",
    message: "No external advisor or security partner on treasury/protocol safe",
    remediation: "Tag at least one signer as external_advisor or security_partner in the roster.",
    sealRef: "signer-composition",
  };
}

export function ruleAllSignersVerified(input: ComplianceInput): ComplianceResult {
  const roster = activeRoster(input.roster);
  if (roster.length === 0) {
    return {
      ruleId: "all_signers_verified",
      status: "warn",
      message: "No roster entries — refresh safe snapshot to sync signers",
      remediation: "Refresh the safe to populate the signer roster.",
      sealRef: "signer-verification",
    };
  }

  const unverified = roster.filter((r) => r.verificationStatus === "unverified" || r.verificationStatus === "pending");
  const attested = roster.filter(
    (r) => r.verificationStatus === "verified" && r.verificationMethod === "admin_attested"
  );
  const verified = roster.filter(
    (r) => r.verificationStatus === "verified" && r.verificationMethod !== "admin_attested"
  );
  const expired = roster.filter((r) => r.verificationStatus === "expired");

  if (unverified.length === 0 && expired.length === 0 && attested.length === 0) {
    return {
      ruleId: "all_signers_verified",
      status: "pass",
      message: `All ${verified.length} signer(s) cryptographically verified`,
      remediation: "",
      sealRef: "signer-verification",
    };
  }

  if (unverified.length === 0 && expired.length === 0 && attested.length > 0) {
    const strict = isStrictClassification(input.classification);
    return {
      ruleId: "all_signers_verified",
      status: strict ? "warn" : "pass",
      message: `${attested.length} signer(s) admin-attested (not cryptographic proof)`,
      remediation: "Request affiliation verification signatures from all signers.",
      sealRef: "signer-verification",
    };
  }

  const issues = unverified.length + expired.length;
  return {
    ruleId: "all_signers_verified",
    status: isStrictClassification(input.classification) ? "fail" : "warn",
    message: `${issues} signer(s) not verified${expired.length ? ` (${expired.length} expired)` : ""}`,
    remediation: "Complete affiliation verification for all on-chain owners.",
    sealRef: "signer-verification",
  };
}

export function ruleRoleDiversity(input: ComplianceInput): ComplianceResult {
  const roster = activeRoster(input.roster);
  if (input.ownersCount < 3) {
    return {
      ruleId: "role_diversity",
      status: "pass",
      message: "Role diversity check applies when N ≥ 3",
      remediation: "",
      sealRef: "signer-composition",
    };
  }

  const roles = new Set(
    roster.map((r) => r.roleLabel?.trim().toLowerCase()).filter(Boolean)
  );

  if (roles.size >= 2) {
    return {
      ruleId: "role_diversity",
      status: "pass",
      message: `${roles.size} distinct role labels across signers`,
      remediation: "",
      sealRef: "signer-composition",
    };
  }

  return {
    ruleId: "role_diversity",
    status: "warn",
    message: "Fewer than 2 distinct role labels for 3+ signers",
    remediation: "Assign role labels (e.g. CTO, Finance lead) to signers in the roster.",
    sealRef: "signer-composition",
  };
}

export function ruleNoUnknownSigners(input: ComplianceInput): ComplianceResult {
  const roster = activeRoster(input.roster);
  if (!isStrictClassification(input.classification)) {
    return {
      ruleId: "no_unknown_signers",
      status: "pass",
      message: "Unknown signer check applies to treasury/protocol safes only",
      remediation: "",
      sealRef: "signer-composition",
    };
  }

  const unknown = roster.filter((r) => r.signerType === "unknown");
  if (unknown.length === 0) {
    return {
      ruleId: "no_unknown_signers",
      status: "pass",
      message: "All signers classified (no unknown types)",
      remediation: "",
      sealRef: "signer-composition",
    };
  }

  return {
    ruleId: "no_unknown_signers",
    status: "fail",
    message: `${unknown.length} signer(s) still typed as unknown`,
    remediation: "Set signer type (internal, external_advisor, security_partner) for each owner.",
    sealRef: "signer-composition",
  };
}

export function ruleDedicatedSignerDeclared(input: ComplianceInput): ComplianceResult {
  const roster = activeRoster(input.roster);
  if (input.classification !== "protocol_critical") {
    return {
      ruleId: "dedicated_signer_declared",
      status: "pass",
      message: "Dedicated signer check applies to protocol-critical safes only",
      remediation: "",
      sealRef: "operational-security",
    };
  }

  const notDedicated = roster.filter((r) => r.isDedicatedSigner === false);
  if (notDedicated.length === 0) {
    return {
      ruleId: "dedicated_signer_declared",
      status: "pass",
      message: "No signers self-report non-dedicated keys",
      remediation: "",
      sealRef: "operational-security",
    };
  }

  return {
    ruleId: "dedicated_signer_declared",
    status: "warn",
    message: `${notDedicated.length} signer(s) report non-dedicated keys`,
    remediation: "Protocol signers should use dedicated signing wallets per SEAL guidance.",
    sealRef: "operational-security",
  };
}

export function ruleHardwareWalletMajority(input: ComplianceInput): ComplianceResult {
  const roster = activeRoster(input.roster);
  if (!isStrictClassification(input.classification)) {
    return {
      ruleId: "hardware_wallet_majority",
      status: "pass",
      message: "Hardware wallet check applies to treasury+ safes only",
      remediation: "",
      sealRef: "operational-security",
    };
  }

  const reported = roster.filter((r) => r.hardwareWallet);
  if (reported.length === 0) {
    return {
      ruleId: "hardware_wallet_majority",
      status: "warn",
      message: "No hardware wallet self-reports on roster",
      remediation: "Record hardware wallet type for each signer (SEAL: all signers use hardware wallets).",
      sealRef: "operational-security",
    };
  }

  const software = reported.filter((r) => r.hardwareWallet === "software");
  if (software.length / reported.length > 0.5) {
    return {
      ruleId: "hardware_wallet_majority",
      status: "warn",
      message: `>${Math.round((software.length / reported.length) * 100)}% of reported signers use software wallets`,
      remediation: "SEAL recommends hardware wallets for all multisig signers.",
      sealRef: "operational-security",
    };
  }

  return {
    ruleId: "hardware_wallet_majority",
    status: "pass",
    message: "Majority of reported signers use hardware wallets",
    remediation: "",
    sealRef: "operational-security",
  };
}

export const PHASE2_RULES = [
  ruleExternalSignerPresent,
  ruleAllSignersVerified,
  ruleRoleDiversity,
  ruleNoUnknownSigners,
  ruleDedicatedSignerDeclared,
  ruleHardwareWalletMajority,
] as const;
