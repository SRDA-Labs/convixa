import {
  countSafesWithDelays,
  countStrictSafesWithTwins,
  countActiveWebhooks,
  countPendingWithoutSimulation,
  getLatestCertificationExport,
  getDelayAttachmentsBySafe,
  getTwinForProductionSafe,
} from "@/lib/db/repositories/governance.repository";
import { getOrCreateGovernanceSettings } from "@/lib/db/repositories/governance.repository";
import { db } from "@/lib/db";
import { safes, safeSnapshots } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { compareTwinSnapshots } from "@/lib/testnet-twins/validate-pair";
import { hasCompletedDrillType } from "@/lib/db/repositories/readiness.repository";
import type { GovernanceComplianceSlice } from "@/lib/seal-compliance/types";

export async function getGovernanceComplianceSlice(
  orgId: string,
  safeId?: string
): Promise<GovernanceComplianceSlice> {
  const settings = await getOrCreateGovernanceSettings(orgId);

  if (safeId) {
    const delays = await getDelayAttachmentsBySafe(safeId);
    const twin = await getTwinForProductionSafe(safeId);
    let twinInSync = true;
    if (twin) {
      const [prodSnap] = await db
        .select()
        .from(safeSnapshots)
        .where(eq(safeSnapshots.safeId, safeId))
        .limit(1);
      const [twinSnap] = await db
        .select()
        .from(safeSnapshots)
        .where(eq(safeSnapshots.safeId, twin.twinSafeId))
        .limit(1);
      if (prodSnap && twinSnap) {
        const drift = compareTwinSnapshots(
          { threshold: prodSnap.threshold, owners: prodSnap.owners },
          { threshold: twinSnap.threshold, owners: twinSnap.owners }
        );
        twinInSync = drift.inSync;
      }
    }

    const testnetDrill90d = await hasCompletedDrillType(orgId, "testnet_sign", 90, safeId);

    return {
      delayAttachmentCount: delays.length,
      maxDelaySeconds: delays.reduce(
        (max, d) => Math.max(max, d.delaySeconds ?? 0),
        0
      ),
      hasTestnetTwin: Boolean(twin),
      twinInSync,
      testnetDrillWithin90d: testnetDrill90d,
      activeWebhooks: 0,
      criticalPolicyGaps: 0,
      pendingWithoutSimulation: 0,
      daysSinceCertificationExport: null,
      minDelaySecondsTreasury: settings.minDelaySecondsTreasury ?? 86400,
      minDelaySecondsProtocol: settings.minDelaySecondsProtocol ?? 172800,
    };
  }

  const [strictSafes, delaysCount, twins, webhooks, pendingSim, lastExport] =
    await Promise.all([
      db
        .select({ id: safes.id })
        .from(safes)
        .where(
          and(
            eq(safes.orgId, orgId),
            inArray(safes.classification, ["treasury", "protocol_critical"])
          )
        ),
      countSafesWithDelays(orgId),
      countStrictSafesWithTwins(orgId),
      countActiveWebhooks(orgId),
      countPendingWithoutSimulation(orgId),
      getLatestCertificationExport(orgId),
    ]);

  let daysSinceExport: number | null = null;
  if (lastExport?.createdAt) {
    daysSinceExport = Math.floor(
      (Date.now() - lastExport.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  return {
    delayAttachmentCount: delaysCount,
    maxDelaySeconds: 0,
    hasTestnetTwin: twins.withTwin > 0,
    twinInSync: true,
    testnetDrillWithin90d: false,
    activeWebhooks: webhooks,
    criticalPolicyGaps: 0,
    pendingWithoutSimulation: pendingSim,
    daysSinceCertificationExport: daysSinceExport,
    strictSafesTotal: strictSafes.length,
    strictSafesWithDelays: delaysCount,
    strictSafesWithTwins: twins.withTwin,
    minDelaySecondsTreasury: settings.minDelaySecondsTreasury ?? 86400,
    minDelaySecondsProtocol: settings.minDelaySecondsProtocol ?? 172800,
  };
}
