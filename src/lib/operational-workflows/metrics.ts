import { eq, and, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  pendingTxReviews,
  safeConfigEvents,
  normalizedEvents,
} from "@/lib/db/schema";
import {
  countChecklistTemplates,
  countOpenOobCases,
  countOverdueOobCases,
  getOobCaseBySafeTxHash,
} from "@/lib/db/repositories/operational-workflows.repository";
import { getSecurityContactEmail } from "./config";
import { GOVERNANCE_EVENTS_FOR_OOB } from "./config";
import { fetchSafePendingTransactions, fetchSafeInfo } from "@/lib/safe-api";
import { getPendingTxReviewSlaHours } from "./config";

const GOVERNANCE_EVENT_TYPES = [...GOVERNANCE_EVENTS_FOR_OOB, "SIGNER_SWAP_PROPOSED"];

export async function getOperationalComplianceSlice(
  orgId: string,
  safeId: string,
  classification: string | null,
  safeAddress?: string,
  network?: string
) {
  const isStrict =
    classification === "treasury" || classification === "protocol_critical";

  const [templatesCount, openOob, overdueOob] = await Promise.all([
    countChecklistTemplates(orgId),
    countOpenOobCases(orgId, safeId),
    countOverdueOobCases(orgId),
  ]);

  let pendingTxsWithoutReview = 0;
  let proposedGovernanceWithoutOob = 0;
  let unverifiedGovernanceEvents7d = 0;

  if (isStrict) {
    [pendingTxsWithoutReview, proposedGovernanceWithoutOob, unverifiedGovernanceEvents7d] =
      await Promise.all([
        countPendingTxsWithoutReview(safeId, safeAddress, network),
        countProposedGovernanceWithoutOob(safeId),
        countUnverifiedGovernanceEvents7d(safeId),
      ]);
  }

  return {
    checklistTemplatesCount: templatesCount,
    openOobCases: openOob,
    overdueOobCases: overdueOob,
    hasSecurityContact: Boolean(getSecurityContactEmail()),
    pendingTxsWithoutReview,
    proposedGovernanceWithoutOob,
    unverifiedGovernanceEvents7d,
  };
}

async function countPendingTxsWithoutReview(
  safeId: string,
  address?: string,
  network?: string
): Promise<number> {
  const slaHours = getPendingTxReviewSlaHours();
  const cutoff = new Date(Date.now() - slaHours * 3600000);

  let pendingHashes: { hash: string; submissionDate: string }[] = [];

  if (address && network) {
    try {
      const info = await fetchSafeInfo(network, address);
      const pending = await fetchSafePendingTransactions(network, address);
      const currentNonce = info?.nonce ?? 0;
      pendingHashes = pending
        .filter((tx) => {
          const txNonce =
            typeof tx.nonce === "string" ? parseInt(tx.nonce, 10) : (tx.nonce ?? 0);
          return txNonce === currentNonce;
        })
        .map((tx) => ({
          hash: tx.safeTxHash,
          submissionDate: tx.submissionDate ?? new Date().toISOString(),
        }));
    } catch {
      return 0;
    }
  }

  let missing = 0;
  for (const { hash, submissionDate } of pendingHashes) {
    if (new Date(submissionDate) > cutoff) continue;

    const reviews = await db
      .select({ status: pendingTxReviews.status })
      .from(pendingTxReviews)
      .where(
        and(
          eq(pendingTxReviews.safeId, safeId),
          eq(pendingTxReviews.safeTxHash, hash),
          inArray(pendingTxReviews.status, ["completed", "signed"])
        )
      );

    if (reviews.length === 0) missing++;
  }

  return missing;
}

async function countProposedGovernanceWithoutOob(safeId: string): Promise<number> {
  const proposed = await db
    .select({
      safeTxHash: normalizedEvents.safeTxHash,
    })
    .from(normalizedEvents)
    .where(
      and(
        eq(normalizedEvents.safeId, safeId),
        inArray(normalizedEvents.eventType, GOVERNANCE_EVENT_TYPES)
      )
    );

  let missing = 0;
  for (const row of proposed) {
    if (!row.safeTxHash) continue;
    const oob = await getOobCaseBySafeTxHash(safeId, row.safeTxHash);
    if (!oob || !["open", "evidence_gathering", "pending_confirmations", "verified"].includes(oob.status)) {
      missing++;
    }
  }
  return missing;
}

async function countUnverifiedGovernanceEvents7d(safeId: string): Promise<number> {
  const since = new Date(Date.now() - 7 * 86400000);

  const executed = await db
    .select({
      safeTxHash: safeConfigEvents.safeTxHash,
      eventType: safeConfigEvents.eventType,
    })
    .from(safeConfigEvents)
    .where(
      and(
        eq(safeConfigEvents.safeId, safeId),
        gte(safeConfigEvents.createdAt, since),
        inArray(safeConfigEvents.eventType, [
          "SIGNER_ADD",
          "SIGNER_REMOVE",
          "THRESHOLD_CHANGE",
          "GUARD_SET",
          "MODULE_CHANGE",
        ])
      )
    );

  let unverified = 0;
  for (const row of executed) {
    if (!row.safeTxHash) {
      unverified++;
      continue;
    }
    const oob = await getOobCaseBySafeTxHash(safeId, row.safeTxHash);
    if (!oob || oob.status !== "verified") unverified++;
  }

  return unverified;
}
