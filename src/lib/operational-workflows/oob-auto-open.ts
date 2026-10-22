/**
 * Auto-open OOB verification cases for critical governance proposals.
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { safes, orgMembers } from "@/lib/db/schema";
import {
  createOobCase,
  getOobCaseBySafeTxHash,
} from "@/lib/db/repositories/operational-workflows.repository";
import {
  getOobVerificationSlaHours,
  GOVERNANCE_EVENTS_FOR_OOB,
} from "@/lib/operational-workflows/config";

const EVENT_TO_CASE_TYPE: Record<string, string> = {
  SIGNER_REMOVE_PROPOSED: "signer_remove",
  SIGNER_ADD_PROPOSED: "signer_add",
  THRESHOLD_CHANGE_PROPOSED: "threshold_change",
  SIGNER_SWAP_PROPOSED: "signer_add",
  GUARD_SET_PROPOSED: "guard_module_change",
  FALLBACK_HANDLER_SET_PROPOSED: "guard_module_change",
  MODULE_CHANGE_PROPOSED: "guard_module_change",
};

export async function maybeAutoOpenOobCase(params: {
  safeId: string;
  safeTxHash: string;
  eventType: string;
  normalizedEventId?: string;
  openedByUserId?: string;
}): Promise<{ created: boolean; caseId?: string }> {
  if (
    !GOVERNANCE_EVENTS_FOR_OOB.includes(
      params.eventType as (typeof GOVERNANCE_EVENTS_FOR_OOB)[number]
    )
  ) {
    return { created: false };
  }

  const [safe] = await db
    .select({
      orgId: safes.orgId,
      classification: safes.classification,
      name: safes.name,
      address: safes.address,
    })
    .from(safes)
    .where(eq(safes.id, params.safeId))
    .limit(1);

  if (!safe) return { created: false };

  const isStrict =
    safe.classification === "treasury" || safe.classification === "protocol_critical";
  if (!isStrict) return { created: false };

  const existing = await getOobCaseBySafeTxHash(params.safeId, params.safeTxHash);
  if (existing) return { created: false, caseId: existing.id };

  let openedBy = params.openedByUserId;
  if (!openedBy) {
    const [owner] = await db
      .select({ userId: orgMembers.userId })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, safe.orgId), eq(orgMembers.role, "owner")))
      .limit(1);
    if (!owner) return { created: false };
    openedBy = owner.userId;
  }

  const caseType = EVENT_TO_CASE_TYPE[params.eventType] ?? "other";
  const dueAt = new Date(Date.now() + getOobVerificationSlaHours() * 3600000);

  const row = await createOobCase({
    orgId: safe.orgId,
    safeId: params.safeId,
    safeTxHash: params.safeTxHash,
    normalizedEventId: params.normalizedEventId ?? null,
    caseType,
    title: `OOB verification: ${params.eventType.replace(/_/g, " ").toLowerCase()}`,
    description: `Auto-opened for ${safe.name ?? safe.address} governance proposal.`,
    dueAt,
    openedByUserId: openedBy,
  });

  return { created: Boolean(row), caseId: row?.id };
}
