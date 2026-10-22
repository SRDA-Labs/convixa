/**
 * Policies (policy engine rules) per org.
 */

import { eq } from "drizzle-orm";
import { db } from "../index";
import { policies } from "../schema";
import { firstOrNull } from "../utils/queries";
import type { DbResult } from "../types";

export async function createPolicy(data: {
  orgId: string;
  name: string;
  type: string;
  scope: string;
  safeId?: string | null;
  config: Record<string, unknown>;
  subscriptionListId?: string | null;
  enabled?: boolean;
  createdByUserId?: string | null;
}) {
  const [policy] = await db
    .insert(policies)
    .values({
      orgId: data.orgId,
      name: data.name,
      type: data.type,
      scope: data.scope,
      safeId: data.safeId ?? null,
      config: data.config,
      subscriptionListId: data.subscriptionListId ?? null,
      enabled: data.enabled ?? true,
      createdByUserId: data.createdByUserId ?? null,
    })
    .returning();
  return firstOrNull([policy]);
}

export async function getPolicyById(id: string): Promise<DbResult<typeof policies.$inferSelect>> {
  const results = await db.select().from(policies).where(eq(policies.id, id)).limit(1);
  return firstOrNull(results);
}

export async function getPoliciesByOrg(orgId: string) {
  return await db
    .select()
    .from(policies)
    .where(eq(policies.orgId, orgId))
    .orderBy(policies.createdAt);
}

export async function updatePolicy(
  id: string,
  data: {
    name?: string;
    type?: string;
    scope?: string;
    safeId?: string | null;
    config?: Record<string, unknown>;
    subscriptionListId?: string | null;
    enabled?: boolean;
  }
) {
  const updates: Partial<{
    name: string;
    type: string;
    scope: string;
    safeId: string | null;
    config: Record<string, unknown>;
    subscriptionListId: string | null;
    enabled: boolean;
  }> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.type !== undefined) updates.type = data.type;
  if (data.scope !== undefined) updates.scope = data.scope;
  if (data.safeId !== undefined) updates.safeId = data.safeId;
  if (data.config !== undefined) updates.config = data.config;
  if (data.subscriptionListId !== undefined) updates.subscriptionListId = data.subscriptionListId;
  if (data.enabled !== undefined) updates.enabled = data.enabled;
  if (Object.keys(updates).length === 0) return getPolicyById(id);
  const [updated] = await db.update(policies).set(updates).where(eq(policies.id, id)).returning();
  return firstOrNull([updated]);
}

export async function deletePolicy(id: string): Promise<boolean> {
  try {
    await db.delete(policies).where(eq(policies.id, id));
    return true;
  } catch {
    return false;
  }
}
