/**
 * Operational workflows repository — Phase 3 checklists, OOB cases, incidents.
 */

import { eq, and, desc, inArray, sql, gte, lt } from "drizzle-orm";
import { db } from "../index";
import {
  checklistTemplates,
  pendingTxReviews,
  oobVerificationCases,
  oobVerificationEvidence,
  oobVerificationConfirmations,
  securityIncidents,
  securityIncidentUpdates,
  securityIncidentParticipants,
  securityIncidentActivity,
  safes,
} from "../schema";
import { users } from "../schema/users.schema";
import { orgMembers } from "../schema/roles.schema";
import { firstOrNull } from "../utils/queries";
import {
  CONVIXA_DEFAULT_TEMPLATES,
  CONVIXA_STANDARD_REVIEW_TEMPLATE_NAME,
  LEGACY_GENERAL_REVIEW_TEMPLATE_NAME,
} from "@/lib/pre-sign-checklist/templates";
import { templateDefToRow } from "@/lib/pre-sign-checklist/resolve-template";
import { OOB_REQUIRED_CHANNELS } from "@/lib/operational-workflows/config";

// ─── Checklist templates ─────────────────────────────────────────────────────

export async function syncDefaultChecklistTemplates(orgId: string) {
  for (const def of CONVIXA_DEFAULT_TEMPLATES) {
    const [existing] = await db
      .select({ id: checklistTemplates.id })
      .from(checklistTemplates)
      .where(
        and(
          eq(checklistTemplates.orgId, orgId),
          eq(checklistTemplates.name, def.name),
          eq(checklistTemplates.isDefault, true)
        )
      )
      .limit(1);

    if (!existing) {
      await db.insert(checklistTemplates).values(templateDefToRow(orgId, def, true));
    }
  }
}

async function migrateLegacyDefaultTemplateNames(orgId: string) {
  await db
    .update(checklistTemplates)
    .set({ name: CONVIXA_STANDARD_REVIEW_TEMPLATE_NAME })
    .where(
      and(
        eq(checklistTemplates.orgId, orgId),
        eq(checklistTemplates.name, LEGACY_GENERAL_REVIEW_TEMPLATE_NAME),
        eq(checklistTemplates.isDefault, true)
      )
    );
}

export async function getChecklistTemplatesByOrg(orgId: string) {
  await syncDefaultChecklistTemplates(orgId);
  await migrateLegacyDefaultTemplateNames(orgId);
  return db
    .select()
    .from(checklistTemplates)
    .where(eq(checklistTemplates.orgId, orgId))
    .orderBy(desc(checklistTemplates.isDefault), checklistTemplates.name);
}

export async function getChecklistTemplateById(id: string) {
  const rows = await db
    .select()
    .from(checklistTemplates)
    .where(eq(checklistTemplates.id, id))
    .limit(1);
  return firstOrNull(rows);
}

export async function createChecklistTemplate(data: {
  orgId: string;
  name: string;
  classification?: string | null;
  txCategories?: string[];
  itemsJson: unknown;
}) {
  const [row] = await db
    .insert(checklistTemplates)
    .values({
      orgId: data.orgId,
      name: data.name,
      classification: data.classification ?? null,
      txCategories: data.txCategories ?? [],
      itemsJson: data.itemsJson as (typeof checklistTemplates.$inferInsert)["itemsJson"],
      isDefault: false,
    })
    .returning();
  return firstOrNull([row]);
}

export async function updateChecklistTemplate(
  id: string,
  data: Partial<{
    name: string;
    classification: string | null;
    txCategories: string[];
    itemsJson: unknown;
  }>
) {
  const [row] = await db
    .update(checklistTemplates)
    .set({ ...data, updatedAt: new Date() } as Record<string, unknown>)
    .where(eq(checklistTemplates.id, id))
    .returning();
  return firstOrNull([row]);
}

export async function countChecklistTemplates(orgId: string) {
  await syncDefaultChecklistTemplates(orgId);
  const rows = await db
    .select({ id: checklistTemplates.id })
    .from(checklistTemplates)
    .where(eq(checklistTemplates.orgId, orgId));
  return rows.length;
}

// ─── Pending tx reviews ──────────────────────────────────────────────────────

export function normalizeSafeTxHash(hash: string): string {
  return hash.trim().toLowerCase();
}

export async function getReviewBySafeTxAndUser(
  safeId: string,
  safeTxHash: string,
  userId: string
) {
  const hash = normalizeSafeTxHash(safeTxHash);
  const rows = await db
    .select()
    .from(pendingTxReviews)
    .where(
      and(
        eq(pendingTxReviews.safeId, safeId),
        sql`lower(${pendingTxReviews.safeTxHash}) = ${hash}`,
        eq(pendingTxReviews.userId, userId)
      )
    )
    .limit(1);
  return firstOrNull(rows);
}

export async function getReviewsBySafeTx(safeId: string, safeTxHash: string) {
  const hash = normalizeSafeTxHash(safeTxHash);
  return db
    .select()
    .from(pendingTxReviews)
    .where(
      and(eq(pendingTxReviews.safeId, safeId), eq(pendingTxReviews.safeTxHash, hash))
    );
}

export async function getReviewsByOrg(orgId: string, teamIds?: string[]) {
  const conditions = [eq(safes.orgId, orgId)];
  if (teamIds && teamIds.length > 0) {
    conditions.push(inArray(safes.teamId, teamIds));
  }

  return db
    .select({
      review: pendingTxReviews,
      safeName: safes.name,
      safeAddress: safes.address,
      network: safes.network,
      classification: safes.classification,
    })
    .from(pendingTxReviews)
    .innerJoin(safes, eq(pendingTxReviews.safeId, safes.id))
    .where(and(...conditions))
    .orderBy(desc(pendingTxReviews.updatedAt));
}

export async function getReviewDetailById(reviewId: string, orgId: string) {
  const rows = await db
    .select({
      review: pendingTxReviews,
      safeName: safes.name,
      safeAddress: safes.address,
      network: safes.network,
      classification: safes.classification,
      reviewerName: users.name,
      reviewerEmail: users.email,
      templateName: checklistTemplates.name,
      templateItems: checklistTemplates.itemsJson,
    })
    .from(pendingTxReviews)
    .innerJoin(safes, eq(pendingTxReviews.safeId, safes.id))
    .innerJoin(users, eq(pendingTxReviews.userId, users.id))
    .leftJoin(checklistTemplates, eq(pendingTxReviews.templateId, checklistTemplates.id))
    .where(and(eq(pendingTxReviews.id, reviewId), eq(pendingTxReviews.orgId, orgId)))
    .limit(1);
  return firstOrNull(rows);
}

export async function getReviewsByUser(userId: string) {
  return db
    .select({
      safeId: pendingTxReviews.safeId,
      safeTxHash: pendingTxReviews.safeTxHash,
      status: pendingTxReviews.status,
    })
    .from(pendingTxReviews)
    .where(eq(pendingTxReviews.userId, userId));
}

export type TxReviewCounts = {
  total: number;
  inProgress: number;
  completed: number;
};

export async function getReviewCountsForTx(
  safeId: string,
  safeTxHash: string
): Promise<TxReviewCounts> {
  const hash = normalizeSafeTxHash(safeTxHash);
  const rows = await db
    .select({ status: pendingTxReviews.status })
    .from(pendingTxReviews)
    .where(
      and(
        eq(pendingTxReviews.safeId, safeId),
        sql`lower(${pendingTxReviews.safeTxHash}) = ${hash}`
      )
    );

  let inProgress = 0;
  let completed = 0;
  for (const row of rows) {
    if (row.status === "completed" || row.status === "signed") completed += 1;
    else inProgress += 1;
  }
  return { total: rows.length, inProgress, completed };
}

export async function upsertPendingTxReview(data: {
  orgId: string;
  safeId: string;
  safeTxHash: string;
  userId: string;
  walletAddress?: string | null;
  templateId?: string | null;
  itemsStateJson?: Record<string, unknown>;
  status?: string;
  signingNote?: string | null;
  completedAt?: Date | null;
}) {
  const safeTxHash = normalizeSafeTxHash(data.safeTxHash);
  const existing = await getReviewBySafeTxAndUser(
    data.safeId,
    safeTxHash,
    data.userId
  );

  if (existing) {
    const [row] = await db
      .update(pendingTxReviews)
      .set({
        walletAddress: data.walletAddress ?? existing.walletAddress,
        templateId: data.templateId ?? existing.templateId,
        itemsStateJson:
          (data.itemsStateJson as (typeof pendingTxReviews.$inferInsert)["itemsStateJson"]) ??
          existing.itemsStateJson,
        status: data.status ?? existing.status,
        signingNote: data.signingNote !== undefined ? data.signingNote : existing.signingNote,
        completedAt: data.completedAt !== undefined ? data.completedAt : existing.completedAt,
        updatedAt: new Date(),
      })
      .where(eq(pendingTxReviews.id, existing.id))
      .returning();
    return firstOrNull([row]);
  }

  const [row] = await db
    .insert(pendingTxReviews)
    .values({
      orgId: data.orgId,
      safeId: data.safeId,
      safeTxHash,
      userId: data.userId,
      walletAddress: data.walletAddress ?? null,
      templateId: data.templateId ?? null,
      itemsStateJson: data.itemsStateJson as (typeof pendingTxReviews.$inferInsert)["itemsStateJson"],
      status: data.status ?? "in_progress",
      signingNote: data.signingNote ?? null,
      completedAt: data.completedAt ?? null,
    })
    .returning();
  return firstOrNull([row]);
}

export async function countCompletedReviewsForTx(safeId: string, safeTxHash: string) {
  const counts = await getReviewCountsForTx(safeId, safeTxHash);
  return counts.completed;
}

// ─── OOB verification ────────────────────────────────────────────────────────

export async function createOobCase(data: {
  orgId: string;
  safeId: string;
  safeTxHash?: string | null;
  configEventId?: string | null;
  normalizedEventId?: string | null;
  caseType: string;
  title: string;
  description?: string | null;
  dueAt?: Date | null;
  openedByUserId: string;
}) {
  const [row] = await db
    .insert(oobVerificationCases)
    .values({
      orgId: data.orgId,
      safeId: data.safeId,
      safeTxHash: data.safeTxHash ?? null,
      configEventId: data.configEventId ?? null,
      normalizedEventId: data.normalizedEventId ?? null,
      caseType: data.caseType,
      title: data.title,
      description: data.description ?? null,
      requiredChannels: [...OOB_REQUIRED_CHANNELS],
      dueAt: data.dueAt ?? null,
      openedByUserId: data.openedByUserId,
      status: "open",
    })
    .returning();
  return firstOrNull([row]);
}

export async function getOobCaseById(caseId: string) {
  const rows = await db
    .select()
    .from(oobVerificationCases)
    .where(eq(oobVerificationCases.id, caseId))
    .limit(1);
  return firstOrNull(rows);
}

export async function getOobCaseBySafeTxHash(safeId: string, safeTxHash: string) {
  const rows = await db
    .select()
    .from(oobVerificationCases)
    .where(
      and(
        eq(oobVerificationCases.safeId, safeId),
        eq(oobVerificationCases.safeTxHash, safeTxHash)
      )
    )
    .limit(1);
  return firstOrNull(rows);
}

export async function getOobCasesBySafe(safeId: string) {
  return db
    .select()
    .from(oobVerificationCases)
    .where(eq(oobVerificationCases.safeId, safeId))
    .orderBy(desc(oobVerificationCases.createdAt));
}

export async function getOobCasesByOrg(orgId: string, statusFilter?: string[]) {
  const conditions = [eq(oobVerificationCases.orgId, orgId)];
  if (statusFilter?.length) {
    conditions.push(inArray(oobVerificationCases.status, statusFilter));
  }
  return db
    .select({
      oobCase: oobVerificationCases,
      safeName: safes.name,
      safeAddress: safes.address,
      network: safes.network,
    })
    .from(oobVerificationCases)
    .innerJoin(safes, eq(oobVerificationCases.safeId, safes.id))
    .where(and(...conditions))
    .orderBy(desc(oobVerificationCases.createdAt));
}

export async function updateOobCase(
  caseId: string,
  data: Partial<{
    status: string;
    description: string | null;
    verifiedAt: Date | null;
  }>
) {
  const [row] = await db
    .update(oobVerificationCases)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(oobVerificationCases.id, caseId))
    .returning();
  return firstOrNull([row]);
}

export async function addOobEvidence(data: {
  caseId: string;
  channel: string;
  submittedByUserId: string;
  evidenceType: string;
  evidenceValue: string;
}) {
  const [row] = await db.insert(oobVerificationEvidence).values(data).returning();
  return firstOrNull([row]);
}

export async function getOobEvidenceByCase(caseId: string) {
  return db
    .select()
    .from(oobVerificationEvidence)
    .where(eq(oobVerificationEvidence.caseId, caseId))
    .orderBy(oobVerificationEvidence.createdAt);
}

export async function addOobConfirmation(data: {
  caseId: string;
  rosterId?: string | null;
  userId: string;
  confirmationText?: string | null;
}) {
  const [row] = await db
    .insert(oobVerificationConfirmations)
    .values({
      caseId: data.caseId,
      rosterId: data.rosterId ?? null,
      userId: data.userId,
      confirmationText: data.confirmationText ?? null,
    })
    .onConflictDoNothing()
    .returning();
  return firstOrNull([row]);
}

export async function getOobConfirmationsByCase(caseId: string) {
  return db
    .select()
    .from(oobVerificationConfirmations)
    .where(eq(oobVerificationConfirmations.caseId, caseId));
}

export async function countOpenOobCases(orgId: string, safeId?: string) {
  const openStatuses = ["open", "evidence_gathering", "pending_confirmations"];
  const conditions = [
    eq(oobVerificationCases.orgId, orgId),
    inArray(oobVerificationCases.status, openStatuses),
  ];
  if (safeId) conditions.push(eq(oobVerificationCases.safeId, safeId));

  const rows = await db
    .select({ id: oobVerificationCases.id })
    .from(oobVerificationCases)
    .where(and(...conditions));
  return rows.length;
}

export async function countOverdueOobCases(orgId: string) {
  const now = new Date();
  const openStatuses = ["open", "evidence_gathering", "pending_confirmations"];
  const rows = await db
    .select({ id: oobVerificationCases.id })
    .from(oobVerificationCases)
    .where(
      and(
        eq(oobVerificationCases.orgId, orgId),
        inArray(oobVerificationCases.status, openStatuses),
        lt(oobVerificationCases.dueAt, now)
      )
    );
  return rows.length;
}

// ─── Security incidents ──────────────────────────────────────────────────────

export async function createSecurityIncident(data: {
  orgId: string;
  reporterUserId?: string | null;
  incidentType: string;
  severity: string;
  title: string;
  description: string;
  affectedSafeIds?: string[];
  affectedSignerAddresses?: string[];
  linkedOobCaseId?: string | null;
  linkedSafeTxHash?: string | null;
}) {
  const [row] = await db
    .insert(securityIncidents)
    .values({
      orgId: data.orgId,
      reporterUserId: data.reporterUserId ?? null,
      incidentType: data.incidentType,
      severity: data.severity,
      title: data.title,
      description: data.description,
      affectedSafeIds: data.affectedSafeIds ?? [],
      affectedSignerAddresses: data.affectedSignerAddresses ?? [],
      linkedOobCaseId: data.linkedOobCaseId ?? null,
      linkedSafeTxHash: data.linkedSafeTxHash ?? null,
      status: "reported",
    })
    .returning();
  const incident = firstOrNull([row]);
  if (incident && data.reporterUserId) {
    await addIncidentParticipant({
      incidentId: incident.id,
      userId: data.reporterUserId,
      role: "reporter",
    });
  }
  return incident;
}

export async function getSecurityIncidentById(id: string) {
  const rows = await db
    .select()
    .from(securityIncidents)
    .where(eq(securityIncidents.id, id))
    .limit(1);
  return firstOrNull(rows);
}

export async function getSecurityIncidentsByOrg(orgId: string) {
  return db
    .select()
    .from(securityIncidents)
    .where(eq(securityIncidents.orgId, orgId))
    .orderBy(desc(securityIncidents.createdAt));
}

export async function updateSecurityIncident(
  id: string,
  data: Partial<{
    status: string;
    severity: string;
    description: string;
    resolutionNotes: string | null;
    resolvedAt: Date | null;
    securityContactNotifiedAt: Date | null;
  }>
) {
  const [row] = await db
    .update(securityIncidents)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(securityIncidents.id, id))
    .returning();
  return firstOrNull([row]);
}

export async function addIncidentParticipant(data: {
  incidentId: string;
  userId: string;
  role?: string;
  invitedByUserId?: string | null;
}) {
  const [row] = await db
    .insert(securityIncidentParticipants)
    .values({
      incidentId: data.incidentId,
      userId: data.userId,
      role: data.role ?? "collaborator",
      invitedByUserId: data.invitedByUserId ?? null,
    })
    .onConflictDoNothing()
    .returning();
  return firstOrNull([row]);
}

export async function isIncidentParticipant(incidentId: string, userId: string) {
  const rows = await db
    .select({ id: securityIncidentParticipants.id })
    .from(securityIncidentParticipants)
    .where(
      and(
        eq(securityIncidentParticipants.incidentId, incidentId),
        eq(securityIncidentParticipants.userId, userId)
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function getIncidentParticipants(incidentId: string) {
  return db
    .select({
      id: securityIncidentParticipants.id,
      userId: securityIncidentParticipants.userId,
      role: securityIncidentParticipants.role,
      invitedByUserId: securityIncidentParticipants.invitedByUserId,
      createdAt: securityIncidentParticipants.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(securityIncidentParticipants)
    .innerJoin(users, eq(securityIncidentParticipants.userId, users.id))
    .where(eq(securityIncidentParticipants.incidentId, incidentId))
    .orderBy(securityIncidentParticipants.createdAt);
}

export async function logIncidentActivity(data: {
  incidentId: string;
  userId?: string | null;
  action: string;
  summary: string;
  metadata?: Record<string, unknown> | null;
}) {
  const [row] = await db
    .insert(securityIncidentActivity)
    .values({
      incidentId: data.incidentId,
      userId: data.userId ?? null,
      action: data.action,
      summary: data.summary,
      metadata: data.metadata ?? null,
    })
    .returning();
  return firstOrNull([row]);
}

export async function getIncidentActivity(incidentId: string, limit = 50) {
  return db
    .select({
      id: securityIncidentActivity.id,
      incidentId: securityIncidentActivity.incidentId,
      userId: securityIncidentActivity.userId,
      action: securityIncidentActivity.action,
      summary: securityIncidentActivity.summary,
      metadata: securityIncidentActivity.metadata,
      createdAt: securityIncidentActivity.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(securityIncidentActivity)
    .leftJoin(users, eq(securityIncidentActivity.userId, users.id))
    .where(eq(securityIncidentActivity.incidentId, incidentId))
    .orderBy(desc(securityIncidentActivity.createdAt))
    .limit(limit);
}

export async function getOrgAdminEmails(orgId: string) {
  return db
    .select({ email: users.email, name: users.name })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(
      and(eq(orgMembers.orgId, orgId), inArray(orgMembers.role, ["admin", "owner"]))
    );
}

export async function getIncidentUpdatesWithUsers(incidentId: string) {
  return db
    .select({
      id: securityIncidentUpdates.id,
      incidentId: securityIncidentUpdates.incidentId,
      userId: securityIncidentUpdates.userId,
      body: securityIncidentUpdates.body,
      createdAt: securityIncidentUpdates.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(securityIncidentUpdates)
    .innerJoin(users, eq(securityIncidentUpdates.userId, users.id))
    .where(eq(securityIncidentUpdates.incidentId, incidentId))
    .orderBy(securityIncidentUpdates.createdAt);
}

export async function getSecurityIncidentDetail(id: string) {
  const rows = await db
    .select({
      incident: securityIncidents,
      reporterName: users.name,
      reporterEmail: users.email,
    })
    .from(securityIncidents)
    .leftJoin(users, eq(securityIncidents.reporterUserId, users.id))
    .where(eq(securityIncidents.id, id))
    .limit(1);
  const row = firstOrNull(rows);
  if (!row) return null;
  return {
    ...row.incident,
    reporterName: row.reporterName,
    reporterEmail: row.reporterEmail,
  };
}

export async function addIncidentUpdate(data: {
  incidentId: string;
  userId: string;
  body: string;
}) {
  const [row] = await db.insert(securityIncidentUpdates).values(data).returning();
  return firstOrNull([row]);
}

export async function getIncidentUpdates(incidentId: string) {
  return db
    .select()
    .from(securityIncidentUpdates)
    .where(eq(securityIncidentUpdates.incidentId, incidentId))
    .orderBy(securityIncidentUpdates.createdAt);
}

export async function countRecentMediumIncidents(orgId: string, since: Date) {
  const rows = await db
    .select({ id: securityIncidents.id })
    .from(securityIncidents)
    .where(
      and(
        eq(securityIncidents.orgId, orgId),
        gte(securityIncidents.createdAt, since),
        inArray(securityIncidents.severity, ["medium", "high", "critical"])
      )
    );
  return rows.length;
}

export async function getOperationalMetricsForSafe(
  orgId: string,
  safeId: string,
  classification: string | null
) {
  const isStrict =
    classification === "treasury" || classification === "protocol_critical";

  const [templatesCount, openOob, overdueOob] = await Promise.all([
    countChecklistTemplates(orgId),
    countOpenOobCases(orgId, safeId),
    countOverdueOobCases(orgId),
  ]);

  return {
    checklistTemplatesCount: templatesCount,
    openOobCases: openOob,
    overdueOobCases: overdueOob,
    hasSecurityContact: Boolean(process.env.SECURITY_CONTACT_EMAIL?.trim()),
    isStrict,
    pendingTxsWithoutReview: 0,
    unverifiedGovernanceEvents7d: 0,
    proposedGovernanceWithoutOob: openOob > 0 ? 0 : 0,
  };
}
