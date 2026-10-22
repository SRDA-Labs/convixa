import { hashMessage, type Hex } from "viem";

export type AffiliationMessageParams = {
  signerAddress: string;
  displayName: string;
  roleLabel: string;
  orgName: string;
  safeAddress: string;
  network: string;
  safePurpose: string;
  requestId: string;
  issuedAt: string;
  expiresAt: string;
};

export function buildAffiliationMessage(params: AffiliationMessageParams): string {
  const role = params.roleLabel.trim() || "Signer";
  const purpose = params.safePurpose.trim() || "Not specified";

  return [
    `I affirm that ${params.signerAddress} is operated by ${params.displayName} (${role})`,
    `affiliated with ${params.orgName} as a signer on Safe ${params.safeAddress} (${params.network}).`,
    "",
    `Purpose: ${purpose}`,
    `Request ID: ${params.requestId}`,
    `Issued: ${params.issuedAt}`,
    `Expires: ${params.expiresAt}`,
  ].join("\n");
}

export function hashAffiliationMessage(message: string): Hex {
  return hashMessage(message);
}

export function getAffiliationProofTtlDays(): number {
  const raw = process.env.AFFILIATION_PROOF_TTL_DAYS;
  const parsed = raw ? parseInt(raw, 10) : 365;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 365;
}

export function getAffiliationChallengeTtlMinutes(): number {
  return 15;
}
