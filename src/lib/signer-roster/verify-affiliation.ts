import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { getAddress, verifyMessage } from "viem";
import { db } from "@/lib/db";
import { orgs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  buildAffiliationMessage,
  getAffiliationChallengeTtlMinutes,
  getAffiliationProofTtlDays,
  hashAffiliationMessage,
} from "./affiliation-message";
import {
  createAffiliationProof,
  updateRosterEntry,
  type RosterRow,
} from "@/lib/db/repositories/safe-signer-roster.repository";
import { createAuditLog } from "@/lib/db/repositories/audit.repository";

export type AffiliationChallengeContext = {
  safeAddress: string;
  network: string;
  orgName: string;
  safePurpose: string;
};

export async function issueAffiliationChallenge(
  roster: RosterRow,
  ctx: AffiliationChallengeContext
) {
  const requestId = randomUUID();
  const issuedAt = new Date();
  const expiresAt = new Date(
    issuedAt.getTime() + getAffiliationChallengeTtlMinutes() * 60 * 1000
  );

  const displayName = roster.displayName?.trim() || "Signer";
  const roleLabel = roster.roleLabel?.trim() || "Signer";

  const message = buildAffiliationMessage({
    signerAddress: roster.signerAddress,
    displayName,
    roleLabel,
    orgName: ctx.orgName,
    safeAddress: ctx.safeAddress,
    network: ctx.network,
    safePurpose: ctx.safePurpose,
    requestId,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  await updateRosterEntry(roster.id, {
    verificationStatus: "pending",
    pendingAffiliationRequestId: requestId,
    pendingAffiliationExpiresAt: expiresAt,
  });

  return { message, requestId, expiresAt };
}

export async function verifyAffiliationSubmission(params: {
  roster: RosterRow;
  message: string;
  signature: string;
  signedByUserId?: string | null;
  orgId: string;
}) {
  const { roster, message, signature, signedByUserId, orgId } = params;

  if (!roster.pendingAffiliationRequestId) {
    return { ok: false as const, error: "No pending verification request" };
  }

  if (
    roster.pendingAffiliationExpiresAt &&
    new Date(roster.pendingAffiliationExpiresAt) <= new Date()
  ) {
    return { ok: false as const, error: "Verification request expired" };
  }

  if (!message.includes(roster.pendingAffiliationRequestId)) {
    return { ok: false as const, error: "Message does not match request" };
  }

  let signerAddress: `0x${string}`;
  try {
    signerAddress = getAddress(roster.signerAddress);
  } catch {
    return { ok: false as const, error: "Invalid signer address on roster" };
  }

  const valid = await verifyMessage({
    address: signerAddress,
    message,
    signature: signature as `0x${string}`,
  });

  if (!valid) {
    return { ok: false as const, error: "Invalid signature" };
  }

  const messageHash = hashAffiliationMessage(message);
  const proofExpiresAt = new Date(
    Date.now() + getAffiliationProofTtlDays() * 86400000
  );

  await createAffiliationProof({
    rosterId: roster.id,
    orgId,
    safeId: roster.safeId,
    signerAddress: roster.signerAddress,
    messageText: message,
    messageHash,
    signature,
    signedByUserId: signedByUserId ?? null,
    expiresAt: proofExpiresAt,
  });

  await updateRosterEntry(roster.id, {
    verificationStatus: "verified",
    verificationMethod: "siwe_affiliation",
    verifiedAt: new Date(),
    verifiedByUserId: signedByUserId ?? null,
    pendingAffiliationRequestId: null,
    pendingAffiliationExpiresAt: null,
  });

  await createAuditLog({
    orgId,
    userId: signedByUserId ?? null,
    action: "signer.verification.complete",
    resourceType: "safe_signer_roster",
    resourceId: roster.id,
    metadata: { safeId: roster.safeId, signerAddress: roster.signerAddress },
  });

  return { ok: true as const };
}

export function hashVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function getOrgName(orgId: string): Promise<string> {
  const [row] = await db.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
  return row?.name ?? "Organization";
}
