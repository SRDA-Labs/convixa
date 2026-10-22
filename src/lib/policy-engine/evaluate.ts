/**
 * Policy engine: evaluate policies on pending transactions.
 * Single version: config must be PolicyConfig (trigger, conditions, actions).
 * Returns alerts (notify) and violations (block).
 */

import { eq, gte, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { policies, normalizedEvents } from "@/lib/db/schema";
import { getSafeById } from "@/lib/db/repositories/safes.repository";
import type { PendingTxInput, PolicyAlert, PolicyViolation, PolicyEvaluationResult } from "./types";
import type { PolicyConfig } from "./config";
import { isPolicyConfig } from "./config";
import { evaluateConditions } from "./conditions";
import type { ConditionContext } from "./conditions";

export type SafeWithPendingTxs = {
  safeId: string;
  safeAddress: string;
  network: string;
  safeName: string | null;
  /** Tags for this safe (e.g. cold, ops). Fetched from DB if not provided. */
  safeTags?: string[];
  /** Multisig implementation type (default "safe"). */
  implementation?: string;
  pendingTxs: PendingTxInput[];
};

/**
 * Evaluate all applicable policies for an org's safes and their pending txs.
 * Only policies with config in PolicyConfig shape (trigger, conditions, actions) are evaluated.
 */
export async function evaluatePolicies(
  orgId: string,
  safesWithPending: SafeWithPendingTxs[]
): Promise<PolicyEvaluationResult> {
  const allPolicies = await db
    .select()
    .from(policies)
    .where(eq(policies.orgId, orgId))
    .orderBy(policies.createdAt);

  const alerts: PolicyAlert[] = [];
  const violations: PolicyViolation[] = [];

  for (const safe of safesWithPending) {
    let safeTags = safe.safeTags;
    if (safeTags === undefined) {
      const safeRow = await getSafeById(safe.safeId);
      safeTags = (safeRow?.tags as string[] | null) ?? [];
    }

    const applicablePolicies = allPolicies.filter(
      (p) => p.enabled && (p.scope === "org" || (p.scope === "safe" && p.safeId === safe.safeId))
    );

    for (const policy of applicablePolicies) {
      const config = policy.config as unknown;
      if (!isPolicyConfig(config)) continue;

      if (config.trigger === "pending_tx") {
        const result = await evaluateOnePolicy(
          policy.id,
          policy.name,
          config,
          orgId,
          safe.safeId,
          safe.safeAddress,
          safe.network,
          safe.safeName ?? null,
          safeTags,
          safe.pendingTxs,
          safe.implementation
        );
        alerts.push(...result.alerts);
        violations.push(...result.violations);
      }

      if (config.trigger === "config_change") {
        // Check normalized events for governance events in last 60 min
        const cutoff = new Date(Date.now() - 60 * 60 * 1000);
        const govEvents = await db
          .select({ eventType: normalizedEvents.eventType })
          .from(normalizedEvents)
          .where(and(
            eq(normalizedEvents.safeId, safe.safeId),
            gte(normalizedEvents.createdAt, cutoff)
          ))
          .limit(20);

        for (const event of govEvents) {
          const ctx = {
            orgId,
            safeId: safe.safeId,
            network: safe.network,
            safeTags: [],
            pendingTxs: safe.pendingTxs,
            implementation: safe.implementation,
          };
          const conditionsPass = await evaluateConditions(config.conditions, ctx);
          if (!conditionsPass) continue;

          for (const action of config.actions) {
            if (action.type === "alert") {
              alerts.push({
                policyId: policy.id,
                policyName: policy.name,
                policyType: config.trigger,
                safeId: safe.safeId,
                safeName: safe.safeName ?? null,
                safeAddress: safe.safeAddress,
                network: safe.network,
                reason: `Governance event: ${event.eventType}`,
              });
            }
            if (action.type === "block") {
              violations.push({
                policyId: policy.id,
                policyName: policy.name,
                policyType: config.trigger,
                safeId: safe.safeId,
                reason: action.reasonTemplate ?? `Governance change blocked: ${event.eventType}`,
              });
            }
          }
        }
      }

      if (config.trigger === "balance_change") {
        // Balance changes are evaluated against snapshot data via condition
        const ctx = {
          orgId,
          safeId: safe.safeId,
          network: safe.network,
          safeTags: [],
          pendingTxs: safe.pendingTxs,
          implementation: safe.implementation,
        };
        const conditionsPass = await evaluateConditions(config.conditions, ctx);
        if (!conditionsPass) continue;

        for (const action of config.actions) {
          if (action.type === "alert") {
            alerts.push({
              policyId: policy.id,
              policyName: policy.name,
              policyType: config.trigger,
              safeId: safe.safeId,
              safeName: safe.safeName ?? null,
              safeAddress: safe.safeAddress,
              network: safe.network,
              reason: "Balance change threshold exceeded",
            });
          }
          if (action.type === "block") {
            violations.push({
              policyId: policy.id,
              policyName: policy.name,
              policyType: config.trigger,
              safeId: safe.safeId,
              reason: action.reasonTemplate ?? "Balance change policy violation",
            });
          }
        }
      }
    }
  }

  return { alerts, violations };
}

async function evaluateOnePolicy(
  policyId: string,
  policyName: string,
  config: PolicyConfig,
  orgId: string,
  safeId: string,
  safeAddress: string,
  network: string,
  safeName: string | null,
  safeTags: string[],
  pendingTxs: PendingTxInput[],
  implementation?: string
): Promise<{ alerts: PolicyAlert[]; violations: PolicyViolation[] }> {
  const alerts: PolicyAlert[] = [];
  const violations: PolicyViolation[] = [];

  const baseCtx: Omit<ConditionContext, "tx"> = {
    orgId,
    safeId,
    network,
    safeTags,
    pendingTxs,
    implementation,
  };

  for (const tx of pendingTxs) {
    const ctx: ConditionContext = { ...baseCtx, tx };
    const conditionsPass = await evaluateConditions(config.conditions, ctx);
    if (!conditionsPass) continue;

    for (const action of config.actions) {
      if (action.type === "alert") {
        alerts.push({
          policyId,
          policyName,
          policyType: config.trigger,
          safeId,
          safeName,
          safeAddress,
          network,
          reason: "Policy condition matched",
          txHash: tx.safeTxHash,
          to: tx.to,
          value: tx.value,
        });
      }
      if (action.type === "block") {
        violations.push({
          policyId,
          policyName,
          policyType: config.trigger,
          safeId,
          safeTxHash: tx.safeTxHash,
          to: tx.to,
          value: tx.value,
          reason: action.reasonTemplate ?? "Policy violation",
        });
      }
    }
  }

  return { alerts, violations };
}
