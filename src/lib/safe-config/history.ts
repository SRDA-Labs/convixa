/**
 * Backfill safe_config_events from executed transaction history.
 */

import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { safeTransactionHistory, safes } from "@/lib/db/schema";
import { classifyTransaction } from "@/lib/alerting/classifier";
import {
  configEventExists,
  insertSafeConfigEvent,
} from "@/lib/db/repositories/safe-config-events.repository";
import type { EventType } from "@/lib/alerting/types";

const GOV_EVENT_MAP: Partial<Record<EventType, string>> = {
  SIGNER_ADD_PROPOSED: "SIGNER_ADDED",
  SIGNER_REMOVE_PROPOSED: "SIGNER_REMOVED",
  SIGNER_SWAP_PROPOSED: "SIGNER_SWAPPED",
  THRESHOLD_CHANGE_PROPOSED: "THRESHOLD_CHANGED",
  GUARD_SET_PROPOSED: "GUARD_SET",
  FALLBACK_HANDLER_SET_PROPOSED: "FALLBACK_HANDLER_SET",
  MODULE_CHANGE_PROPOSED: "MODULE_ENABLED",
};

export async function backfillConfigEventsFromHistory(
  safeId: string,
  limit = 100
): Promise<number> {
  const [safe] = await db
    .select({ orgId: safes.orgId, address: safes.address })
    .from(safes)
    .where(eq(safes.id, safeId))
    .limit(1);
  if (!safe?.orgId) return 0;

  const rows = await db
    .select()
    .from(safeTransactionHistory)
    .where(eq(safeTransactionHistory.safeId, safeId))
    .orderBy(desc(safeTransactionHistory.executedAt))
    .limit(limit);

  let inserted = 0;
  for (const row of rows) {
    const classified = classifyTransaction({
      safeId,
      safeAddress: safe.address,
      safeTxHash: row.safeTxHash,
      toAddress: row.toAddress,
      value: row.valueWei,
      data: row.data,
      operation: row.operation ?? 0,
      proposedBy: row.toAddress,
      nonce: row.nonce,
    });

    const mappedType = GOV_EVENT_MAP[classified.eventType];
    if (!mappedType) continue;

    const exists = await configEventExists(safeId, mappedType, row.safeTxHash);
    if (exists) continue;

    await insertSafeConfigEvent({
      safeId,
      orgId: safe.orgId,
      eventType: mappedType,
      source: "executed_tx",
      safeTxHash: row.safeTxHash,
      afterJson: classified.metadata,
      severity:
        mappedType === "SIGNER_REMOVED" || mappedType === "THRESHOLD_CHANGED"
          ? "warning"
          : "info",
    });
    inserted++;
  }

  return inserted;
}
