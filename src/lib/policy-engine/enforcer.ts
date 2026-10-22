/**
 * Policy Enforcer: runs policy evaluation against pending transactions
 * and persists fire logs for any matched policies.
 *
 * Called by the poller after collecting pending txs for all safes in an org.
 */

import { evaluatePolicies } from "./evaluate";
import type { PendingTxInput, PolicyAlert, PolicyViolation } from "./types";
import { createPolicyFireLog } from "../db/repositories/policy-fire-log.repository";

export interface SafePendingData {
  safeId: string;
  safeAddress: string;
  network: string;
  safeName: string | null;
  safeTags?: string[];
  pendingTxs: PendingTxInput[];
  implementation?: string;
}

export interface EnforcementResult {
  orgId: string;
  policiesEvaluated: number;
  alertsCreated: number;
  violationsCreated: number;
  errors: string[];
}

/**
 * Evaluate all enabled policies for an org against collected pending txs,
 * and persist fire logs for matched alerts and violations.
 */
export async function enforcePoliciesForOrg(
  orgId: string,
  safesWithPending: SafePendingData[]
): Promise<EnforcementResult> {
  const errors: string[] = [];
  let alertsCreated = 0;
  let violationsCreated = 0;

  try {
    const evalResult = await evaluatePolicies(orgId, safesWithPending);

    // Persist alerts
    for (const alert of evalResult.alerts) {
      try {
        await createPolicyFireLog({
          policyId: alert.policyId,
          orgId,
          safeId: alert.safeId,
          safeTxHash: alert.txHash ?? null,
          triggerType: alert.policyType,
          actionType: "alert",
          actionDetails: {
            severity: "warning",
            reason: alert.reason,
            to: alert.to,
            value: alert.value,
          },
        });
        alertsCreated++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("duplicate") && !msg.includes("unique")) {
          errors.push(`Alert fire log: ${msg}`);
        }
      }
    }

    // Persist violations (blocks)
    for (const violation of evalResult.violations) {
      try {
        await createPolicyFireLog({
          policyId: violation.policyId,
          orgId,
          safeId: violation.safeId,
          safeTxHash: violation.safeTxHash ?? null,
          triggerType: violation.policyType,
          actionType: "block",
          actionDetails: {
            reason: violation.reason,
            to: violation.to,
            value: violation.value,
          },
        });
        violationsCreated++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("duplicate") && !msg.includes("unique")) {
          errors.push(`Violation fire log: ${msg}`);
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Policy evaluation failed for org ${orgId}: ${msg}`);
  }

  return {
    orgId,
    policiesEvaluated: 0, // populated by caller if needed
    alertsCreated,
    violationsCreated,
    errors,
  };
}

/**
 * Collect pending tx data during the poll cycle, then run enforcement
 * for each org at the end of the cycle.
 */
export async function runPolicyEnforcement(
  perOrgData: Map<string, SafePendingData[]>
): Promise<EnforcementResult[]> {
  const results: EnforcementResult[] = [];

  for (const [orgId, safes] of perOrgData) {
    if (safes.length === 0) continue;
    const result = await enforcePoliciesForOrg(orgId, safes);
    results.push(result);
  }

  return results;
}
