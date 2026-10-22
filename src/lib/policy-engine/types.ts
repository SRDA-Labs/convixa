/**
 * Policy engine types: inputs and outcomes.
 */

/** Minimal pending tx shape for policy evaluation (from Safe API or our store). */
export type PendingTxInput = {
  to: string;
  value: string;
  data: string | null;
  operation: number;
  safeTxHash?: string;
  /** Number of confirmations received so far (provider-agnostic). */
  confirmations?: number;
  /** Required confirmations (provider-agnostic). */
  confirmationsRequired?: number;
  /** When the tx was submitted (ISO string). */
  submissionDate?: string;
  /** Who proposed the tx (address). */
  proposedBy?: string;
  /** Nonce of the transaction. */
  nonce?: number;
};

/** Outcome of evaluating one policy on one tx: alert (notify), block (violation), or allow. */
export type PolicyOutcome = "alert" | "block" | "allow";

export type PolicyAlert = {
  policyId: string;
  policyName: string;
  policyType: string;
  safeId: string;
  safeName: string | null;
  safeAddress: string;
  network: string;
  reason: string;
  /** When evaluated per-tx, the tx that triggered the alert (e.g. to, value). */
  txHash?: string;
  to?: string;
  value?: string;
};

export type PolicyViolation = {
  policyId: string;
  policyName: string;
  policyType: string;
  safeId: string;
  safeTxHash?: string;
  to?: string;
  value?: string;
  reason: string;
};

export type PolicyEvaluationResult = {
  alerts: PolicyAlert[];
  violations: PolicyViolation[];
};
