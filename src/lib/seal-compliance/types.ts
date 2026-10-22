export type ComplianceStatus = "pass" | "warn" | "fail";

export type SafeClassification =
  | "personal"
  | "operational"
  | "treasury"
  | "protocol_critical"
  | null;

export type SignerType =
  | "internal"
  | "external_advisor"
  | "security_partner"
  | "unknown";

export type VerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "expired"
  | "revoked";

export interface RosterEntry {
  signerAddress: string;
  signerType: SignerType | string;
  roleLabel: string | null;
  verificationStatus: VerificationStatus | string;
  verificationMethod: string | null;
  hardwareWallet: string | null;
  isDedicatedSigner: boolean | null;
  removedAt: Date | string | null;
}

export interface OperationalComplianceSlice {
  pendingTxsWithoutReview: number;
  openOobCases: number;
  overdueOobCases: number;
  unverifiedGovernanceEvents7d: number;
  proposedGovernanceWithoutOob: number;
  hasSecurityContact: boolean;
  checklistTemplatesCount: number;
}

export interface ReadinessComplianceSlice {
  onboardingTemplatesCount: number;
  onboardingCompletionPct: number;
  overdueDrills: number;
  drillCompletedWithin90d: boolean;
  playbookScenariosPublished: number;
  playbookScenariosExpected: number;
  stalePlaybooks: number;
}

export interface GovernanceComplianceSlice {
  delayAttachmentCount: number;
  maxDelaySeconds: number;
  hasTestnetTwin: boolean;
  twinInSync: boolean;
  testnetDrillWithin90d: boolean;
  activeWebhooks: number;
  criticalPolicyGaps: number;
  pendingWithoutSimulation: number;
  daysSinceCertificationExport: number | null;
  minDelaySecondsTreasury: number;
  minDelaySecondsProtocol: number;
  strictSafesTotal?: number;
  strictSafesWithDelays?: number;
  strictSafesWithTwins?: number;
}

export interface PolicyGapEntry {
  id: string;
  severity: "info" | "warn" | "critical";
  category: string;
  message: string;
  remediation: string;
}

export interface ComplianceInput {
  threshold: number;
  ownersCount: number;
  classification: SafeClassification;
  purpose: string | null;
  moduleExceptionNote: string | null;
  modulesCount: number;
  estimatedUsd: number | null;
  roster?: RosterEntry[];
  operational?: OperationalComplianceSlice;
  readiness?: ReadinessComplianceSlice;
  governance?: GovernanceComplianceSlice;
  policyGaps?: PolicyGapEntry[];
}

export interface ComplianceResult {
  ruleId: string;
  status: ComplianceStatus;
  message: string;
  remediation: string;
  sealRef?: string;
}

export interface ComplianceSummary {
  pass: number;
  warn: number;
  fail: number;
  results: ComplianceResult[];
  recommendedThreshold: number;
  recommendedOwners: number;
  inferredClassification: SafeClassification;
}
