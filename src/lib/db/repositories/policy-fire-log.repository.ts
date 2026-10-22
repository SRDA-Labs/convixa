/**
 * Policy Fire Log Repository — audit trail for policy enforcement events.
 */

import { eq, and, desc, gte, inArray } from "drizzle-orm";
import { db } from "../index";
import { policyFireLogs } from "../schema/policy-fire-log.schema";
import { policies } from "../schema/policies.schema";
import { safes } from "../schema/safes.schema";

export interface CreatePolicyFireLogInput {
  policyId: string;
  orgId: string;
  safeId: string;
  safeTxHash?: string | null;
  triggerType: string;
  actionType: "alert" | "block";
  actionDetails?: Record<string, unknown>;
  notificationSent?: boolean;
}

export async function createPolicyFireLog(input: CreatePolicyFireLogInput) {
  try {
    const [row] = await db
      .insert(policyFireLogs)
      .values({
        policyId: input.policyId,
        orgId: input.orgId,
        safeId: input.safeId,
        safeTxHash: input.safeTxHash ?? null,
        triggerType: input.triggerType,
        actionType: input.actionType,
        actionDetails: (input.actionDetails ?? {}) as Record<string, unknown>,
        notificationSent: input.notificationSent ?? false,
      })
      .returning();
    return row ?? null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return null; // idempotent — already logged
    }
    throw err;
  }
}

export async function getPolicyFireLogsByOrg(
  orgId: string,
  options?: {
    limit?: number;
    offset?: number;
    triggerType?: string;
    actionType?: string;
    policyId?: string;
  }
) {
  const { limit = 50, offset = 0, triggerType, actionType, policyId } = options ?? {};
  const conditions = [eq(policyFireLogs.orgId, orgId)];
  if (triggerType) conditions.push(eq(policyFireLogs.triggerType, triggerType));
  if (actionType) conditions.push(eq(policyFireLogs.actionType, actionType));
  if (policyId) conditions.push(eq(policyFireLogs.policyId, policyId));

  const rows = await db
    .select({
      id: policyFireLogs.id,
      policyId: policyFireLogs.policyId,
      policyName: policies.name,
      safeId: policyFireLogs.safeId,
      safeAddress: safes.address,
      safeName: safes.name,
      safeTxHash: policyFireLogs.safeTxHash,
      triggerType: policyFireLogs.triggerType,
      actionType: policyFireLogs.actionType,
      actionDetails: policyFireLogs.actionDetails,
      notificationSent: policyFireLogs.notificationSent,
      notificationSentAt: policyFireLogs.notificationSentAt,
      firedAt: policyFireLogs.firedAt,
    })
    .from(policyFireLogs)
    .innerJoin(policies, eq(policyFireLogs.policyId, policies.id))
    .innerJoin(safes, eq(policyFireLogs.safeId, safes.id))
    .where(and(...conditions))
    .orderBy(desc(policyFireLogs.firedAt))
    .limit(limit)
    .offset(offset);

  return rows;
}

export async function getPolicyFireLogsByPolicy(policyId: string, limit = 20, offset = 0) {
  return db
    .select({
      id: policyFireLogs.id,
      safeId: policyFireLogs.safeId,
      safeAddress: safes.address,
      safeName: safes.name,
      safeTxHash: policyFireLogs.safeTxHash,
      triggerType: policyFireLogs.triggerType,
      actionType: policyFireLogs.actionType,
      actionDetails: policyFireLogs.actionDetails,
      notificationSent: policyFireLogs.notificationSent,
      firedAt: policyFireLogs.firedAt,
    })
    .from(policyFireLogs)
    .innerJoin(safes, eq(policyFireLogs.safeId, safes.id))
    .where(eq(policyFireLogs.policyId, policyId))
    .orderBy(desc(policyFireLogs.firedAt))
    .limit(limit)
    .offset(offset);
}

export async function getLastFiredForPolicies(
  policyIds: string[]
): Promise<Map<string, Date>> {
  if (policyIds.length === 0) return new Map();
  const rows = await db
    .select({
      policyId: policyFireLogs.policyId,
      firedAt: policyFireLogs.firedAt,
    })
    .from(policyFireLogs)
    .where(inArray(policyFireLogs.policyId, policyIds))
    .orderBy(desc(policyFireLogs.firedAt));

  const map = new Map<string, Date>();
  for (const row of rows) {
    if (!map.has(row.policyId)) {
      map.set(row.policyId, row.firedAt);
    }
  }
  return map;
}

export async function getRecentPolicyFires(orgId: string, sinceHours = 24, limit = 20) {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  return db
    .select({
      id: policyFireLogs.id,
      policyId: policyFireLogs.policyId,
      policyName: policies.name,
      safeId: policyFireLogs.safeId,
      safeAddress: safes.address,
      safeName: safes.name,
      safeTxHash: policyFireLogs.safeTxHash,
      triggerType: policyFireLogs.triggerType,
      actionType: policyFireLogs.actionType,
      actionDetails: policyFireLogs.actionDetails,
      firedAt: policyFireLogs.firedAt,
    })
    .from(policyFireLogs)
    .innerJoin(policies, eq(policyFireLogs.policyId, policies.id))
    .innerJoin(safes, eq(policyFireLogs.safeId, safes.id))
    .where(and(eq(policyFireLogs.orgId, orgId), gte(policyFireLogs.firedAt, since)))
    .orderBy(desc(policyFireLogs.firedAt))
    .limit(limit);
}

export async function markNotificationSent(fireLogId: string): Promise<void> {
  await db
    .update(policyFireLogs)
    .set({
      notificationSent: true,
      notificationSentAt: new Date(),
    })
    .where(eq(policyFireLogs.id, fireLogId));
}

export async function getUnnotifiedPolicyFireLogs(limit = 100) {
  return db
    .select({
      id: policyFireLogs.id,
      policyId: policyFireLogs.policyId,
      policyName: policies.name,
      policySubscriptionListId: policies.subscriptionListId,
      orgId: policyFireLogs.orgId,
      safeId: policyFireLogs.safeId,
      safeAddress: safes.address,
      safeName: safes.name,
      safeTxHash: policyFireLogs.safeTxHash,
      triggerType: policyFireLogs.triggerType,
      actionType: policyFireLogs.actionType,
      actionDetails: policyFireLogs.actionDetails,
      firedAt: policyFireLogs.firedAt,
    })
    .from(policyFireLogs)
    .innerJoin(policies, eq(policyFireLogs.policyId, policies.id))
    .innerJoin(safes, eq(policyFireLogs.safeId, safes.id))
    .where(eq(policyFireLogs.notificationSent, false))
    .orderBy(policyFireLogs.firedAt)
    .limit(limit);
}
