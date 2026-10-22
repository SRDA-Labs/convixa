/**
 * Alert configuration validation utilities.
 * Used by alert rules API endpoints.
 */

export const ALERT_TYPES = [
  "pending_tx",
  "queue_stuck",
  "balance_change_pct",
  "balance_change_abs",
  "signer_change",
  "threshold_decreased",
  "signer_count_decreased",
  "config_change_critical",
  "unverified_signers",
  "missing_external_signer",
  "signer_eoa_activity",
  "verification_expiring",
  "pending_tx_unreviewed",
  "oob_verification_overdue",
  "oob_verification_required",
  "security_incident_reported",
  "drill_overdue",
  "onboarding_incomplete",
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

/**
 * Validates alert rule configuration based on type.
 * Returns validation result with error message if invalid.
 */
export function validateConfig(type: string, config: unknown): { valid: boolean; error?: string } {
  if (type === "pending_tx") {
    const c = config as { minCount?: number };
    if (typeof c?.minCount !== "number" || c.minCount < 0) {
      return { valid: false, error: "minCount must be a non-negative number" };
    }
    return { valid: true };
  }

  if (type === "queue_stuck") {
    const c = config as { days?: number };
    if (typeof c?.days !== "number" || c.days < 1) {
      return { valid: false, error: "days must be a positive number" };
    }
    return { valid: true };
  }

  if (type === "balance_change_pct") {
    const c = config as { percent?: number };
    if (typeof c?.percent !== "number" || c.percent <= 0) {
      return { valid: false, error: "percent must be a positive number" };
    }
    return { valid: true };
  }

  if (type === "config_change_critical") {
    const c = config as { hours?: number };
    if (c?.hours != null && (typeof c.hours !== "number" || c.hours < 1)) {
      return { valid: false, error: "hours must be a positive number" };
    }
    return { valid: true };
  }

  if (type === "signer_eoa_activity") {
    const c = config as { lookbackDays?: number; minOutgoingCount?: number };
    if (c?.lookbackDays != null && (typeof c.lookbackDays !== "number" || c.lookbackDays < 1)) {
      return { valid: false, error: "lookbackDays must be a positive number" };
    }
    if (c?.minOutgoingCount != null && (typeof c.minOutgoingCount !== "number" || c.minOutgoingCount < 1)) {
      return { valid: false, error: "minOutgoingCount must be a positive number" };
    }
    return { valid: true };
  }

  if (type === "verification_expiring") {
    const c = config as { daysBeforeExpiry?: number };
    if (c?.daysBeforeExpiry != null && (typeof c.daysBeforeExpiry !== "number" || c.daysBeforeExpiry < 1)) {
      return { valid: false, error: "daysBeforeExpiry must be a positive number" };
    }
    return { valid: true };
  }

  if (type === "pending_tx_unreviewed") {
    const c = config as { hours?: number };
    if (c?.hours != null && (typeof c.hours !== "number" || c.hours < 1)) {
      return { valid: false, error: "hours must be a positive number" };
    }
    return { valid: true };
  }

  if (
    type === "unverified_signers" ||
    type === "missing_external_signer" ||
    type === "oob_verification_overdue" ||
    type === "oob_verification_required" ||
    type === "security_incident_reported" ||
    type === "drill_overdue" ||
    type === "onboarding_incomplete"
  ) {
    return { valid: true };
  }

  if (
    type === "balance_change_abs" ||
    type === "signer_change" ||
    type === "threshold_decreased" ||
    type === "signer_count_decreased"
  ) {
    return { valid: true };
  }

  return { valid: false, error: "Unknown rule type" };
}
