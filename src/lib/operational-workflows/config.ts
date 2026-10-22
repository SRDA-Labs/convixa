export function getOobVerificationSlaHours(): number {
  const raw = process.env.OOB_VERIFICATION_SLA_HOURS;
  const parsed = raw ? parseInt(raw, 10) : 48;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 48;
}

export function getPendingTxReviewSlaHours(): number {
  const raw = process.env.PENDING_TX_REVIEW_SLA_HOURS;
  const parsed = raw ? parseInt(raw, 10) : 24;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
}

export function getSecurityContactEmail(): string | null {
  const email = process.env.SECURITY_CONTACT_EMAIL?.trim();
  return email || null;
}

export const OOB_REQUIRED_CHANNELS = [
  "video_call",
  "secondary_messenger",
  "signed_message",
] as const;

export const GOVERNANCE_EVENTS_FOR_OOB = [
  "SIGNER_REMOVE_PROPOSED",
  "THRESHOLD_CHANGE_PROPOSED",
  "SIGNER_ADD_PROPOSED",
  "GUARD_SET_PROPOSED",
  "FALLBACK_HANDLER_SET_PROPOSED",
  "MODULE_CHANGE_PROPOSED",
] as const;
