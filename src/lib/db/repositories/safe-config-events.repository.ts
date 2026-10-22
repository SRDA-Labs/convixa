import { eq, desc, and, gte } from "drizzle-orm";
import { db } from "../index";
import { safeConfigEvents } from "../schema";
import { firstOrNull } from "../utils/queries";

export type InsertSafeConfigEvent = {
  safeId: string;
  orgId: string;
  eventType: string;
  source: string;
  safeTxHash?: string | null;
  beforeJson?: unknown;
  afterJson?: unknown;
  severity?: string;
};

export async function insertSafeConfigEvent(data: InsertSafeConfigEvent) {
  const [row] = await db
    .insert(safeConfigEvents)
    .values({
      safeId: data.safeId,
      orgId: data.orgId,
      eventType: data.eventType,
      source: data.source,
      safeTxHash: data.safeTxHash ?? null,
      beforeJson: data.beforeJson ?? null,
      afterJson: data.afterJson ?? null,
      severity: data.severity ?? "info",
    })
    .returning();
  return firstOrNull([row]);
}

export async function getConfigEventsBySafe(safeId: string, limit = 50) {
  return db
    .select()
    .from(safeConfigEvents)
    .where(eq(safeConfigEvents.safeId, safeId))
    .orderBy(desc(safeConfigEvents.createdAt))
    .limit(limit);
}

export async function hasCriticalConfigEventSince(
  safeId: string,
  since: Date
): Promise<boolean> {
  const rows = await db
    .select({ id: safeConfigEvents.id })
    .from(safeConfigEvents)
    .where(
      and(
        eq(safeConfigEvents.safeId, safeId),
        eq(safeConfigEvents.severity, "critical"),
        gte(safeConfigEvents.createdAt, since)
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function configEventExists(
  safeId: string,
  eventType: string,
  safeTxHash: string | null
): Promise<boolean> {
  const conditions = [
    eq(safeConfigEvents.safeId, safeId),
    eq(safeConfigEvents.eventType, eventType),
  ];
  const rows = await db
    .select({ id: safeConfigEvents.id })
    .from(safeConfigEvents)
    .where(
      safeTxHash
        ? and(...conditions, eq(safeConfigEvents.safeTxHash, safeTxHash))
        : and(...conditions)
    )
    .limit(1);
  return rows.length > 0;
}
