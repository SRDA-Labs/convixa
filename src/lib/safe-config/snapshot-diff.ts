/**
 * Compare Safe snapshots and emit configuration change events.
 */

import {
  insertSafeConfigEvent,
  type InsertSafeConfigEvent,
} from "@/lib/db/repositories/safe-config-events.repository";
import { upsertAlertSafeState } from "@/lib/db/repositories/alerts.repository";

type SnapshotSlice = {
  threshold: number | null;
  owners: string[] | null;
  guardAddress?: string | null;
  fallbackHandler?: string | null;
  modulesJson?: Array<{ address: string }> | null;
};

function normalizeOwners(owners: unknown): string[] {
  if (!owners) return [];
  if (Array.isArray(owners)) {
    return owners.map((o) => String(o).toLowerCase()).sort();
  }
  return [];
}

function ownersEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

export async function detectAndRecordSnapshotDiff(
  safeId: string,
  orgId: string,
  before: SnapshotSlice | null,
  after: SnapshotSlice
): Promise<InsertSafeConfigEvent[]> {
  const events: InsertSafeConfigEvent[] = [];
  const beforeOwners = normalizeOwners(before?.owners);
  const afterOwners = normalizeOwners(after.owners);
  const beforeThreshold = before?.threshold ?? null;
  const afterThreshold = after.threshold ?? null;

  if (before && !ownersEqual(beforeOwners, afterOwners)) {
    const added = afterOwners.filter((o) => !beforeOwners.includes(o));
    const removed = beforeOwners.filter((o) => !afterOwners.includes(o));
    const severity =
      afterOwners.length < beforeOwners.length ? "critical" : "warning";

    if (removed.length > 0) {
      events.push({
        safeId,
        orgId,
        eventType: "SIGNER_REMOVED",
        source: "snapshot_diff",
        beforeJson: { owners: beforeOwners, removed },
        afterJson: { owners: afterOwners },
        severity,
      });
    }
    if (added.length > 0) {
      events.push({
        safeId,
        orgId,
        eventType: "SIGNER_ADDED",
        source: "snapshot_diff",
        beforeJson: { owners: beforeOwners },
        afterJson: { owners: afterOwners, added },
        severity: "warning",
      });
    }
    if (afterOwners.length < beforeOwners.length) {
      events.push({
        safeId,
        orgId,
        eventType: "SIGNER_COUNT_DECREASED",
        source: "snapshot_diff",
        beforeJson: { count: beforeOwners.length },
        afterJson: { count: afterOwners.length },
        severity: "critical",
      });
    }
  }

  if (
    before &&
    beforeThreshold != null &&
    afterThreshold != null &&
    beforeThreshold !== afterThreshold
  ) {
    const severity = afterThreshold < beforeThreshold ? "critical" : "warning";
    events.push({
      safeId,
      orgId,
      eventType:
        afterThreshold < beforeThreshold ? "THRESHOLD_DECREASED" : "THRESHOLD_CHANGED",
      source: "snapshot_diff",
      beforeJson: { threshold: beforeThreshold },
      afterJson: { threshold: afterThreshold },
      severity,
    });
  }

  const beforeGuard = before?.guardAddress ?? null;
  const afterGuard = after.guardAddress ?? null;
  if (before && beforeGuard !== afterGuard && afterGuard) {
    events.push({
      safeId,
      orgId,
      eventType: "GUARD_SET",
      source: "snapshot_diff",
      beforeJson: { guard: beforeGuard },
      afterJson: { guard: afterGuard },
      severity: "warning",
    });
  }

  const beforeModules = (before?.modulesJson ?? []).map((m) => m.address.toLowerCase()).sort();
  const afterModules = (after.modulesJson ?? []).map((m) => m.address.toLowerCase()).sort();
  if (before && JSON.stringify(beforeModules) !== JSON.stringify(afterModules)) {
    const added = afterModules.filter((m) => !beforeModules.includes(m));
    for (const mod of added) {
      events.push({
        safeId,
        orgId,
        eventType: "MODULE_ENABLED",
        source: "snapshot_diff",
        afterJson: { module: mod },
        severity: "warning",
      });
    }
  }

  for (const ev of events) {
    await insertSafeConfigEvent(ev);
  }

  await upsertAlertSafeState({
    safeId,
    lastOwnersJson: afterOwners,
    lastThreshold: afterThreshold,
  });

  return events;
}
