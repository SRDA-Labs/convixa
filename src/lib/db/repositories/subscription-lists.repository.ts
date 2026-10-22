/**
 * Subscription lists (email lists for alert-rule first-fire notifications).
 */

import { and, eq } from "drizzle-orm";
import { db } from "../index";
import { subscriptionLists, subscriptionListMembers } from "../schema";
import { firstOrNull } from "../utils/queries";
import type { DbResult } from "../types";

export async function createSubscriptionList(data: {
  organizationId: string;
  name: string;
}) {
  const [list] = await db
    .insert(subscriptionLists)
    .values({
      organizationId: data.organizationId,
      name: data.name,
    })
    .returning();
  return firstOrNull([list]);
}

export async function getSubscriptionListById(id: string): Promise<DbResult<typeof subscriptionLists.$inferSelect>> {
  const results = await db.select().from(subscriptionLists).where(eq(subscriptionLists.id, id)).limit(1);
  return firstOrNull(results);
}

export async function getSubscriptionListsByOrg(organizationId: string) {
  return await db
    .select()
    .from(subscriptionLists)
    .where(eq(subscriptionLists.organizationId, organizationId))
    .orderBy(subscriptionLists.createdAt);
}

export async function updateSubscriptionList(id: string, data: { name: string }) {
  const [updated] = await db
    .update(subscriptionLists)
    .set({ name: data.name })
    .where(eq(subscriptionLists.id, id))
    .returning();
  return firstOrNull([updated]);
}

export async function deleteSubscriptionList(id: string): Promise<boolean> {
  try {
    await db.delete(subscriptionLists).where(eq(subscriptionLists.id, id));
    return true;
  } catch {
    return false;
  }
}

export async function getSubscriptionListMembers(subscriptionListId: string): Promise<{ email: string }[]> {
  const rows = await db
    .select({ email: subscriptionListMembers.email })
    .from(subscriptionListMembers)
    .where(eq(subscriptionListMembers.subscriptionListId, subscriptionListId));
  return rows.map((r) => ({ email: r.email }));
}

export async function addSubscriptionListMember(subscriptionListId: string, email: string) {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return null;
  const existing = await db
    .select()
    .from(subscriptionListMembers)
    .where(
      and(
        eq(subscriptionListMembers.subscriptionListId, subscriptionListId),
        eq(subscriptionListMembers.email, trimmed)
      )
    )
    .limit(1);
  if (existing.length > 0) return existing[0];
  const [member] = await db
    .insert(subscriptionListMembers)
    .values({ subscriptionListId, email: trimmed })
    .returning();
  return firstOrNull([member]);
}

export async function removeSubscriptionListMember(memberId: string): Promise<boolean> {
  try {
    await db.delete(subscriptionListMembers).where(eq(subscriptionListMembers.id, memberId));
    return true;
  } catch {
    return false;
  }
}

export async function getSubscriptionListMembersWithIds(subscriptionListId: string) {
  return await db
    .select({ id: subscriptionListMembers.id, email: subscriptionListMembers.email })
    .from(subscriptionListMembers)
    .where(eq(subscriptionListMembers.subscriptionListId, subscriptionListId));
}
