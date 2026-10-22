/**
 * Audit Repository
 * 
 * Handles all database operations for Audit Logs.
 */

import { eq, desc } from "drizzle-orm";
import { db } from "../index";
import { auditLogs } from "../schema";
import { firstOrNull } from "../utils/queries";

/**
 * Create an Audit Log entry
 */
export async function createAuditLog(data: {
  orgId: string;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: any | null;
  ip?: string | null;
}) {
  const [log] = await db
    .insert(auditLogs)
    .values({
      orgId: data.orgId,
      userId: data.userId ?? null,
      action: data.action,
      resourceType: data.resourceType,
      resourceId: data.resourceId ?? null,
      metadata: data.metadata ?? null,
      ip: data.ip ?? null,
    })
    .returning();

  return firstOrNull([log]);
}

/**
 * Get Audit Logs for an organization
 */
export async function getAuditLogsByOrg(orgId: string, options?: { limit?: number; offset?: number }) {
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  return await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.orgId, orgId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get Audit Logs for a specific user
 */
export async function getAuditLogsByUser(userId: string, options?: { limit?: number; offset?: number }) {
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  return await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);
}

