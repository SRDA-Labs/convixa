import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDefaultOrgId, getDefaultTeams, hasPermission } from "@/lib/auth-server";
import { db } from "@/lib/db";
import {
  alertRules,
  alertSafeState,
  safes,
  safeSnapshots,
  signerEoaActivity,
  normalizedEvents,
  pendingTxReviews,
} from "@/lib/db/schema";
import { eq, inArray, desc, and } from "drizzle-orm";
import { fetchSafeInfo, fetchSafePendingTransactions } from "@/lib/safe-api";
import { hasCriticalConfigEventSince } from "@/lib/db/repositories/safe-config-events.repository";
import { getRosterBySafeId } from "@/lib/db/repositories/safe-signer-roster.repository";
import { getAffiliationProofTtlDays } from "@/lib/signer-roster/affiliation-message";
import {
  countOverdueOobCases,
  getOobCaseBySafeTxHash,
  countRecentMediumIncidents,
} from "@/lib/db/repositories/operational-workflows.repository";
import { getPendingTxReviewSlaHours } from "@/lib/operational-workflows/config";
import { updateRuleFireStateAndDetectFirstFire } from "@/lib/alerting/rule-fire-state";
import { sendRuleFirstFireEmail } from "@/lib/alerting/rule-notifications";
import { getSubscriptionListMembers } from "@/lib/db/repositories/subscription-lists.repository";

export type FiringAlert = {
  ruleId: string;
  ruleName: string | null;
  ruleType: string;
  safeId: string;
  safeName: string | null;
  safeAddress: string;
  network: string;
  reason: string;
};

/** GET /api/alerts/status – evaluate all rules for the current org and return firing alerts. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getDefaultOrgId();
  if (!orgId) return NextResponse.json({ firing: [] });

  if (!(await hasPermission("safes:read", orgId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userTeams = await getDefaultTeams();
  const teamIds = userTeams.map((t) => t.teamId);
  if (teamIds.length === 0) return NextResponse.json({ firing: [] });

  const safesList = await db
    .select({
      id: safes.id,
      address: safes.address,
      network: safes.network,
      name: safes.name,
      classification: safes.classification,
      orgId: safes.orgId,
    })
    .from(safes)
    .where(inArray(safes.teamId, teamIds));

  const rules = await db
    .select()
    .from(alertRules)
    .where(eq(alertRules.orgId, orgId));

  const firing: FiringAlert[] = [];
  const safeById = new Map(safesList.map((s) => [s.id, s]));

  for (const rule of rules) {
    // rule.config is already an object (PostgreSQL JSON column)
    const config = (rule.config as Record<string, unknown>) ?? {};

    const targetSafes = rule.safeId
      ? (safeById.has(rule.safeId) ? [safeById.get(rule.safeId)!] : [])
      : safesList;

    for (const safe of targetSafes) {
      const result = await evaluateRuleForSafe(
        rule.type,
        config,
        safe.id,
        safe.address,
        safe.network,
        safe.name,
        safe.classification,
        safe.orgId
      );
      const currentlyFiring = result.firing;

      const { firstFire } = await updateRuleFireStateAndDetectFirstFire(rule.id, safe.id, currentlyFiring);

      if (firstFire && rule.subscriptionListId && currentlyFiring) {
        const members = await getSubscriptionListMembers(rule.subscriptionListId);
        const recipients = members.map((m) => m.email).filter(Boolean);
        if (recipients.length > 0) {
          sendRuleFirstFireEmail({
            rule: { name: rule.name ?? null, type: rule.type },
            safe: { name: safe.name ?? null, address: safe.address, network: safe.network },
            reason: result.reason,
            recipients,
          }).catch((err) => console.error("[alerts/status] First-fire email failed:", err));
        }
      }

      if (currentlyFiring) {
        firing.push({
          ruleId: rule.id,
          ruleName: rule.name ?? null,
          ruleType: rule.type,
          safeId: safe.id,
          safeName: safe.name ?? null,
          safeAddress: safe.address,
          network: safe.network,
          reason: result.reason,
        });
      }
    }
  }

  return NextResponse.json({ firing });
}

async function evaluateRuleForSafe(
  type: string,
  config: Record<string, unknown>,
  safeId: string,
  address: string,
  network: string,
  _safeName: string | null,
  classification?: string | null,
  orgId?: string
): Promise<{ firing: boolean; reason: string }> {
  if (type === "pending_tx") {
    const minCount = typeof config.minCount === "number" ? config.minCount : 0;
    const { pendingCount } = await getPendingCountAndOldest(safeId, address, network);
    if (pendingCount >= minCount) {
      return { firing: true, reason: `${pendingCount} pending transaction(s) (threshold: ≥${minCount})` };
    }
    return { firing: false, reason: "" };
  }

  if (type === "queue_stuck") {
    const days = typeof config.days === "number" ? config.days : 3;
    const { oldestSubmissionDate } = await getPendingCountAndOldest(safeId, address, network);
    if (oldestSubmissionDate) {
      const oldest = new Date(oldestSubmissionDate);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      if (oldest <= cutoff) {
        return { firing: true, reason: `Oldest pending tx is ${Math.floor((Date.now() - oldest.getTime()) / 86400000)} days old (alert: >${days} days)` };
      }
    }
    return { firing: false, reason: "" };
  }

  if (type === "balance_change_pct" || type === "balance_change_abs") {
    return { firing: false, reason: "" };
  }

  const snapshotState = await getSnapshotAndAlertState(safeId);

  if (type === "signer_change") {
    const lastOwners = normalizeOwners(snapshotState.alertState?.lastOwnersJson);
    const currentOwners = normalizeOwners(snapshotState.snapshot?.owners);
    if (lastOwners.length > 0 && currentOwners.length > 0 && !ownersEqual(lastOwners, currentOwners)) {
      return { firing: true, reason: "Safe owners changed since last recorded state" };
    }
    return { firing: false, reason: "" };
  }

  if (type === "threshold_decreased") {
    const last = snapshotState.alertState?.lastThreshold;
    const current = snapshotState.snapshot?.threshold;
    if (last != null && current != null && current < last) {
      return { firing: true, reason: `Threshold decreased from ${last} to ${current}` };
    }
    return { firing: false, reason: "" };
  }

  if (type === "signer_count_decreased") {
    const lastOwners = normalizeOwners(snapshotState.alertState?.lastOwnersJson);
    const currentOwners = normalizeOwners(snapshotState.snapshot?.owners);
    if (lastOwners.length > 0 && currentOwners.length < lastOwners.length) {
      return {
        firing: true,
        reason: `Signer count decreased from ${lastOwners.length} to ${currentOwners.length}`,
      };
    }
    return { firing: false, reason: "" };
  }

  if (type === "config_change_critical") {
    const hours = typeof config.hours === "number" ? config.hours : 24;
    const since = new Date(Date.now() - hours * 3600 * 1000);
    const hasCritical = await hasCriticalConfigEventSince(safeId, since);
    if (hasCritical) {
      return { firing: true, reason: `Critical configuration change in last ${hours}h` };
    }
    return { firing: false, reason: "" };
  }

  if (type === "unverified_signers") {
    const strict =
      classification === "treasury" || classification === "protocol_critical";
    if (!strict) return { firing: false, reason: "" };

    const roster = await getRosterBySafeId(safeId);
    const unverified = roster.filter(
      (r) => r.verificationStatus === "unverified" || r.verificationStatus === "pending"
    );
    if (unverified.length > 0) {
      return {
        firing: true,
        reason: `${unverified.length} unverified signer(s) on treasury/protocol safe`,
      };
    }
    return { firing: false, reason: "" };
  }

  if (type === "missing_external_signer") {
    const strict =
      classification === "treasury" || classification === "protocol_critical";
    if (!strict) return { firing: false, reason: "" };

    const roster = await getRosterBySafeId(safeId);
    const hasExternal = roster.some(
      (r) => r.signerType === "external_advisor" || r.signerType === "security_partner"
    );
    if (!hasExternal) {
      return { firing: true, reason: "No external advisor or security partner on roster" };
    }
    return { firing: false, reason: "" };
  }

  if (type === "signer_eoa_activity") {
    const minCount = typeof config.minOutgoingCount === "number" ? config.minOutgoingCount : 1;
    const roster = await getRosterBySafeId(safeId);
    let flagged = 0;
    for (const r of roster) {
      const conditions = [
        eq(signerEoaActivity.signerAddress, r.signerAddress.toLowerCase()),
        eq(signerEoaActivity.network, network),
      ];
      if (orgId) conditions.push(eq(signerEoaActivity.orgId, orgId));

      const [activity] = await db
        .select({ activityCount7d: signerEoaActivity.activityCount7d })
        .from(signerEoaActivity)
        .where(and(...conditions))
        .limit(1);
      if ((activity?.activityCount7d ?? 0) >= minCount) flagged++;
    }
    if (flagged > 0) {
      return {
        firing: true,
        reason: `${flagged} signer(s) with ≥${minCount} outgoing EOA tx in last 7 days`,
      };
    }
    return { firing: false, reason: "" };
  }

  if (type === "verification_expiring") {
    const daysBefore = typeof config.daysBeforeExpiry === "number" ? config.daysBeforeExpiry : 30;
    const ttlDays = getAffiliationProofTtlDays();
    const warnCutoff = new Date(Date.now() - (ttlDays - daysBefore) * 86400000);
    const roster = await getRosterBySafeId(safeId);
    const expiring = roster.filter(
      (r) =>
        r.verificationStatus === "verified" &&
        r.verifiedAt &&
        new Date(r.verifiedAt) <= warnCutoff
    );
    if (expiring.length > 0) {
      return {
        firing: true,
        reason: `${expiring.length} signer verification(s) approaching expiry`,
      };
    }
    return { firing: false, reason: "" };
  }

  if (type === "pending_tx_unreviewed") {
    const strict =
      classification === "treasury" || classification === "protocol_critical";
    if (!strict) return { firing: false, reason: "" };

    const hours =
      typeof config.hours === "number" ? config.hours : getPendingTxReviewSlaHours();
    const { pendingCount, oldestSubmissionDate } = await getPendingCountAndOldest(
      safeId,
      address,
      network
    );
    if (pendingCount === 0 || !oldestSubmissionDate) {
      return { firing: false, reason: "" };
    }

    const oldest = new Date(oldestSubmissionDate);
    const cutoff = new Date(Date.now() - hours * 3600000);
    if (oldest > cutoff) return { firing: false, reason: "" };

    const pendingRaw = await fetchSafePendingTransactions(network, address);
    const info = await fetchSafeInfo(network, address);
    const currentNonce = info?.nonce ?? 0;
    const pending = pendingRaw.filter((tx) => {
      const txNonce = typeof tx.nonce === "string" ? parseInt(tx.nonce, 10) : (tx.nonce ?? 0);
      return txNonce === currentNonce;
    });

    let unreviewed = 0;
    for (const tx of pending) {
      const reviews = await db
        .select({ id: pendingTxReviews.id })
        .from(pendingTxReviews)
        .where(
          and(
            eq(pendingTxReviews.safeId, safeId),
            eq(pendingTxReviews.safeTxHash, tx.safeTxHash),
            inArray(pendingTxReviews.status, ["completed", "signed"])
          )
        );
      if (reviews.length === 0) unreviewed++;
    }

    if (unreviewed > 0) {
      return {
        firing: true,
        reason: `${unreviewed} pending tx(s) older than ${hours}h without completed reviews`,
      };
    }
    return { firing: false, reason: "" };
  }

  if (type === "oob_verification_overdue") {
    if (!orgId) return { firing: false, reason: "" };
    const overdue = await countOverdueOobCases(orgId);
    if (overdue > 0) {
      return {
        firing: true,
        reason: `${overdue} OOB verification case(s) past SLA deadline`,
      };
    }
    return { firing: false, reason: "" };
  }

  if (type === "oob_verification_required") {
    const strict =
      classification === "treasury" || classification === "protocol_critical";
    if (!strict) return { firing: false, reason: "" };

    const governanceTypes = [
      "SIGNER_REMOVE_PROPOSED",
      "THRESHOLD_CHANGE_PROPOSED",
      "SIGNER_ADD_PROPOSED",
      "GUARD_SET_PROPOSED",
      "MODULE_CHANGE_PROPOSED",
    ];

    const proposed = await db
      .select({ safeTxHash: normalizedEvents.safeTxHash })
      .from(normalizedEvents)
      .where(
        and(
          eq(normalizedEvents.safeId, safeId),
          inArray(normalizedEvents.eventType, governanceTypes)
        )
      );

    let missing = 0;
    for (const row of proposed) {
      if (!row.safeTxHash) continue;
      const oob = await getOobCaseBySafeTxHash(safeId, row.safeTxHash);
      if (!oob) missing++;
    }

    if (missing > 0) {
      return {
        firing: true,
        reason: `${missing} governance proposal(s) without OOB verification case`,
      };
    }
    return { firing: false, reason: "" };
  }

  if (type === "security_incident_reported") {
    if (!orgId) return { firing: false, reason: "" };
    const since = new Date(Date.now() - 24 * 3600000);
    const count = await countRecentMediumIncidents(orgId, since);
    if (count > 0) {
      return {
        firing: true,
        reason: `${count} security incident(s) reported in last 24h`,
      };
    }
    return { firing: false, reason: "" };
  }

  return { firing: false, reason: "" };
}

function normalizeOwners(owners: unknown): string[] {
  if (!owners || !Array.isArray(owners)) return [];
  return owners.map((o) => String(o).toLowerCase()).sort();
}

function ownersEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

async function getSnapshotAndAlertState(safeId: string) {
  const [snapshot] = await db
    .select({
      threshold: safeSnapshots.threshold,
      owners: safeSnapshots.owners,
      lastOwnersCount: safeSnapshots.lastOwnersCount,
    })
    .from(safeSnapshots)
    .where(eq(safeSnapshots.safeId, safeId))
    .orderBy(desc(safeSnapshots.refreshedAt))
    .limit(1);

  const [alertState] = await db
    .select()
    .from(alertSafeState)
    .where(eq(alertSafeState.safeId, safeId))
    .limit(1);

  return { snapshot, alertState };
}

async function getPendingCountAndOldest(
  safeId: string,
  address: string,
  network: string
): Promise<{ pendingCount: number; oldestSubmissionDate: string | null }> {
  try {
    const info = await fetchSafeInfo(network, address);
    const pendingRaw = await fetchSafePendingTransactions(network, address);
    const currentNonce = info?.nonce ?? 0;
    const pending = pendingRaw.filter((tx) => {
      const txNonce = typeof tx.nonce === "string" ? parseInt(tx.nonce, 10) : (tx.nonce ?? 0);
      return txNonce === currentNonce;
    });
    const pendingCount = pending.length;
    let oldestSubmissionDate: string | null = null;
    if (pending.length > 0) {
      const dates = pending.map((t) => t.submissionDate).filter(Boolean);
      if (dates.length > 0) oldestSubmissionDate = dates.reduce((a, b) => (a < b ? a : b));
    }
    return { pendingCount, oldestSubmissionDate };
  } catch {
    const [snapshot] = await db
      .select({ pendingCount: safeSnapshots.pendingCount })
      .from(safeSnapshots)
      .where(eq(safeSnapshots.safeId, safeId))
      .orderBy(desc(safeSnapshots.refreshedAt))
      .limit(1);
    return {
      pendingCount: snapshot?.pendingCount ?? 0,
      oldestSubmissionDate: null,
    };
  }
}
