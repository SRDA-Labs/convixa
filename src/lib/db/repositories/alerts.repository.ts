/**
 * Alerts Repository
 * 
 * Handles all database operations for Alert Rules and Alert State.
 */

import { eq, and, isNull, or, sql } from "drizzle-orm";
import { db } from "../index";
import { alertRules, alertSafeState, alertSubscriptions } from "../schema";
import { parseCount } from "../utils/queries";
import { firstOrNull } from "../utils/queries";
import type { DbResult } from "../types";

/**
 * Create an Alert Rule
 */
export async function createAlertRule(data: {
  orgId: string;
  safeId?: string | null;
  subscriptionListId?: string | null;
  type: string;
  config: any;
  name?: string | null;
  createdByUserId?: string | null;
}) {
  const [rule] = await db
    .insert(alertRules)
    .values({
      orgId: data.orgId,
      safeId: data.safeId ?? null,
      subscriptionListId: data.subscriptionListId ?? null,
      type: data.type,
      config: data.config,
      name: data.name ?? null,
      createdByUserId: data.createdByUserId ?? null,
    })
    .returning();

  return firstOrNull([rule]);
}

/**
 * Get an Alert Rule by ID
 */
export async function getAlertRuleById(ruleId: string): Promise<DbResult<typeof alertRules.$inferSelect>> {
  const results = await db
    .select()
    .from(alertRules)
    .where(eq(alertRules.id, ruleId))
    .limit(1);
  return firstOrNull(results);
}

/**
 * Count Alert Rules for an organization
 */
export async function countAlertRulesByOrg(orgId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(alertRules)
    .where(eq(alertRules.orgId, orgId));
  return parseCount(result);
}

/**
 * Get all Alert Rules for an organization
 */
export async function getAlertRulesByOrg(orgId: string) {
  return await db
    .select()
    .from(alertRules)
    .where(eq(alertRules.orgId, orgId))
    .orderBy(alertRules.createdAt);
}

/**
 * Get Alert Rules for a specific Safe
 */
export async function getAlertRulesForSafe(safeId: string, orgId: string) {
  return await db
    .select()
    .from(alertRules)
    .where(
      and(
        eq(alertRules.orgId, orgId),
        or(eq(alertRules.safeId, safeId), isNull(alertRules.safeId))
      )
    )
    .orderBy(alertRules.createdAt);
}

/**
 * Update an Alert Rule
 */
export async function updateAlertRule(
  ruleId: string,
  data: {
    subscriptionListId?: string | null;
    type?: string;
    config?: any;
    name?: string | null;
  }
) {
  const [updated] = await db
    .update(alertRules)
    .set(data)
    .where(eq(alertRules.id, ruleId))
    .returning();

  return firstOrNull([updated]);
}

/**
 * Delete an Alert Rule
 */
export async function deleteAlertRule(ruleId: string): Promise<boolean> {
  try {
    await db.delete(alertRules).where(eq(alertRules.id, ruleId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Upsert Alert Safe State
 */
export async function upsertAlertSafeState(data: {
  safeId: string;
  lastBalancesJson?: any | null;
  lastOwnersJson?: any | null;
  lastThreshold?: number | null;
  lastPendingOldestAt?: Date | null;
}) {
  const existing = await db
    .select()
    .from(alertSafeState)
    .where(eq(alertSafeState.safeId, data.safeId))
    .limit(1);

  if (existing.length > 0) {
    // Update
    const [updated] = await db
      .update(alertSafeState)
      .set({
        lastBalancesJson: data.lastBalancesJson ?? existing[0].lastBalancesJson,
        lastOwnersJson: data.lastOwnersJson ?? existing[0].lastOwnersJson,
        lastThreshold: data.lastThreshold ?? existing[0].lastThreshold,
        lastPendingOldestAt: data.lastPendingOldestAt ?? existing[0].lastPendingOldestAt,
        updatedAt: new Date(),
      })
      .where(eq(alertSafeState.safeId, data.safeId))
      .returning();
    return firstOrNull([updated]);
  } else {
    // Insert
    const [created] = await db
      .insert(alertSafeState)
      .values({
        safeId: data.safeId,
        lastBalancesJson: data.lastBalancesJson ?? null,
        lastOwnersJson: data.lastOwnersJson ?? null,
        lastThreshold: data.lastThreshold ?? null,
        lastPendingOldestAt: data.lastPendingOldestAt ?? null,
      })
      .returning();
    return firstOrNull([created]);
  }
}

/**
 * Get Alert Safe State
 */
export async function getAlertSafeState(safeId: string) {
  const results = await db
    .select()
    .from(alertSafeState)
    .where(eq(alertSafeState.safeId, safeId))
    .limit(1);
  return firstOrNull(results);
}

// --- Proposal-time alert subscriptions ---

export async function createAlertSubscription(data: {
  organizationId: string;
  safeId?: string | null;
  subscriptionListId?: string | null;
  eventType: string;
  channel: "email" | "slack";
  channelConfig: { email?: string; webhookUrl?: string };
  enabled?: boolean;
}) {
  const [sub] = await db
    .insert(alertSubscriptions)
    .values({
      organizationId: data.organizationId,
      safeId: data.safeId ?? null,
      subscriptionListId: data.subscriptionListId ?? null,
      eventType: data.eventType,
      channel: data.channel,
      channelConfig: data.channelConfig,
      enabled: data.enabled ?? true,
    })
    .returning();
  return firstOrNull([sub]);
}

export async function getAlertSubscriptionsByOrg(organizationId: string) {
  return await db
    .select()
    .from(alertSubscriptions)
    .where(eq(alertSubscriptions.organizationId, organizationId))
    .orderBy(alertSubscriptions.createdAt);
}

export async function updateAlertSubscription(
  id: string,
  data: { eventType?: string; channelConfig?: Record<string, unknown>; enabled?: boolean; subscriptionListId?: string | null }
) {
  const [updated] = await db
    .update(alertSubscriptions)
    .set(data)
    .where(eq(alertSubscriptions.id, id))
    .returning();
  return firstOrNull([updated]);
}

export async function deleteAlertSubscription(id: string): Promise<boolean> {
  try {
    await db.delete(alertSubscriptions).where(eq(alertSubscriptions.id, id));
    return true;
  } catch {
    return false;
  }
}
