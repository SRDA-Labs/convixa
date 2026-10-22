/**
 * Readiness repository — Phase 4 onboarding, drills, playbooks, snapshots.
 */

import { eq, and, desc, isNull, gte, lte, inArray, sql } from "drizzle-orm";
import { db } from "../index";
import {
  signerOnboardingTemplates,
  signerOnboardingProgress,
  emergencyDrillSchedules,
  emergencyDrillRuns,
  disasterRecoveryPlaybooks,
  readinessSnapshots,
  safeSignerRoster,
  safes,
} from "../schema";
import { firstOrNull } from "../utils/queries";
import {
  CONVIXA_DEFAULT_ONBOARDING_TEMPLATE,
  CONVIXA_DEFAULT_ONBOARDING_TEMPLATE_NAME,
} from "@/lib/readiness/onboarding-templates";
import { CONVIXA_DEFAULT_PLAYBOOKS } from "@/lib/readiness/default-playbooks";
import {
  computeNextDueAt,
  type DrillCadence,
} from "@/lib/readiness/drill-types";
import { isDrillOverdue } from "@/lib/readiness/drill-scheduler";
import { getOnboardingSlaDays } from "@/lib/readiness/config";

// ─── Onboarding templates ────────────────────────────────────────────────────

export async function syncDefaultOnboardingTemplates(orgId: string) {
  const [existing] = await db
    .select({ id: signerOnboardingTemplates.id })
    .from(signerOnboardingTemplates)
    .where(
      and(
        eq(signerOnboardingTemplates.orgId, orgId),
        eq(signerOnboardingTemplates.name, CONVIXA_DEFAULT_ONBOARDING_TEMPLATE_NAME),
        eq(signerOnboardingTemplates.isDefault, true)
      )
    )
    .limit(1);

  if (!existing) {
    await db.insert(signerOnboardingTemplates).values({
      orgId,
      name: CONVIXA_DEFAULT_ONBOARDING_TEMPLATE.name,
      itemsJson: CONVIXA_DEFAULT_ONBOARDING_TEMPLATE.items,
      isDefault: true,
    });
  }
}

export async function getOnboardingTemplatesByOrg(orgId: string) {
  await syncDefaultOnboardingTemplates(orgId);
  return db
    .select()
    .from(signerOnboardingTemplates)
    .where(eq(signerOnboardingTemplates.orgId, orgId))
    .orderBy(desc(signerOnboardingTemplates.isDefault), signerOnboardingTemplates.name);
}

export async function getOnboardingTemplateById(id: string) {
  const rows = await db
    .select()
    .from(signerOnboardingTemplates)
    .where(eq(signerOnboardingTemplates.id, id))
    .limit(1);
  return firstOrNull(rows);
}

export async function updateOnboardingTemplate(
  id: string,
  data: Partial<{
    name: string;
    itemsJson: unknown;
  }>
) {
  const [row] = await db
    .update(signerOnboardingTemplates)
    .set({ ...data, updatedAt: new Date() } as typeof signerOnboardingTemplates.$inferInsert)
    .where(eq(signerOnboardingTemplates.id, id))
    .returning();
  return firstOrNull([row]);
}

export async function countOnboardingTemplates(orgId: string): Promise<number> {
  await syncDefaultOnboardingTemplates(orgId);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(signerOnboardingTemplates)
    .where(eq(signerOnboardingTemplates.orgId, orgId));
  return row?.count ?? 0;
}

// ─── Onboarding progress ───────────────────────────────────────────────────────

export async function getDefaultOnboardingTemplate(orgId: string) {
  await syncDefaultOnboardingTemplates(orgId);
  const rows = await db
    .select()
    .from(signerOnboardingTemplates)
    .where(
      and(
        eq(signerOnboardingTemplates.orgId, orgId),
        eq(signerOnboardingTemplates.isDefault, true)
      )
    )
    .limit(1);
  return firstOrNull(rows);
}

export async function getOnboardingProgressByRosterId(rosterId: string) {
  const rows = await db
    .select()
    .from(signerOnboardingProgress)
    .where(eq(signerOnboardingProgress.rosterId, rosterId))
    .limit(1);
  return firstOrNull(rows);
}

export async function ensureOnboardingProgressForRoster(
  orgId: string,
  rosterId: string
) {
  const existing = await getOnboardingProgressByRosterId(rosterId);
  if (existing) return existing;

  const [roster] = await db
    .select()
    .from(safeSignerRoster)
    .where(eq(safeSignerRoster.id, rosterId))
    .limit(1);
  if (!roster || roster.orgId !== orgId) return null;

  const template = await getDefaultOnboardingTemplate(orgId);
  const [row] = await db
    .insert(signerOnboardingProgress)
    .values({
      orgId,
      rosterId,
      safeId: roster.safeId,
      signerAddress: roster.signerAddress,
      templateId: template?.id ?? null,
      itemsStateJson: {},
      status: "in_progress",
    })
    .returning();
  return firstOrNull([row]);
}

export async function upsertOnboardingProgress(data: {
  rosterId: string;
  orgId: string;
  itemsStateJson: Record<string, unknown>;
  status: string;
  completedByUserId?: string | null;
}) {
  const existing = await getOnboardingProgressByRosterId(data.rosterId);
  const completedAt = data.status === "completed" ? new Date() : null;

  if (existing) {
    const [row] = await db
      .update(signerOnboardingProgress)
      .set({
        itemsStateJson: data.itemsStateJson as (typeof signerOnboardingProgress.$inferInsert)["itemsStateJson"],
        status: data.status,
        completedAt,
        completedByUserId: data.completedByUserId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(signerOnboardingProgress.id, existing.id))
      .returning();
    return firstOrNull([row]);
  }

  const roster = await db
    .select()
    .from(safeSignerRoster)
    .where(eq(safeSignerRoster.id, data.rosterId))
    .limit(1)
    .then(firstOrNull);
  if (!roster) return null;

  const template = await getDefaultOnboardingTemplate(data.orgId);
  const [row] = await db
    .insert(signerOnboardingProgress)
    .values({
      orgId: data.orgId,
      rosterId: data.rosterId,
      safeId: roster.safeId,
      signerAddress: roster.signerAddress,
      templateId: template?.id ?? null,
      itemsStateJson: data.itemsStateJson as (typeof signerOnboardingProgress.$inferInsert)["itemsStateJson"],
      status: data.status,
      completedAt,
      completedByUserId: data.completedByUserId ?? null,
    })
    .returning();
  return firstOrNull([row]);
}

export async function getOnboardingProgressByOrg(orgId: string) {
  return db
    .select({
      progress: signerOnboardingProgress,
      roster: safeSignerRoster,
      safeName: safes.name,
      safeAddress: safes.address,
      classification: safes.classification,
    })
    .from(signerOnboardingProgress)
    .innerJoin(safeSignerRoster, eq(signerOnboardingProgress.rosterId, safeSignerRoster.id))
    .innerJoin(safes, eq(signerOnboardingProgress.safeId, safes.id))
    .where(
      and(
        eq(signerOnboardingProgress.orgId, orgId),
        isNull(safeSignerRoster.removedAt)
      )
    )
    .orderBy(safes.name, safeSignerRoster.signerAddress);
}

export async function countOnboardingStats(orgId: string): Promise<{
  total: number;
  completed: number;
  inProgress: number;
}> {
  const rows = await db
    .select({
      status: signerOnboardingProgress.status,
      count: sql<number>`count(*)::int`,
    })
    .from(signerOnboardingProgress)
    .innerJoin(safeSignerRoster, eq(signerOnboardingProgress.rosterId, safeSignerRoster.id))
    .where(
      and(
        eq(signerOnboardingProgress.orgId, orgId),
        isNull(safeSignerRoster.removedAt)
      )
    )
    .groupBy(signerOnboardingProgress.status);

  let total = 0;
  let completed = 0;
  let inProgress = 0;
  for (const r of rows) {
    total += r.count;
    if (r.status === "completed") completed += r.count;
    else inProgress += r.count;
  }
  return { total, completed, inProgress };
}

export async function countIncompleteOnboardingPastSla(orgId: string): Promise<number> {
  const slaDays = getOnboardingSlaDays();
  const cutoff = new Date(Date.now() - slaDays * 86400000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(signerOnboardingProgress)
    .innerJoin(safeSignerRoster, eq(signerOnboardingProgress.rosterId, safeSignerRoster.id))
    .where(
      and(
        eq(signerOnboardingProgress.orgId, orgId),
        isNull(safeSignerRoster.removedAt),
        inArray(signerOnboardingProgress.status, ["in_progress"]),
        lte(signerOnboardingProgress.createdAt, cutoff)
      )
    );
  return row?.count ?? 0;
}

export async function bootstrapOnboardingForOrg(orgId: string) {
  const rosterRows = await db
    .select({ id: safeSignerRoster.id })
    .from(safeSignerRoster)
    .where(and(eq(safeSignerRoster.orgId, orgId), isNull(safeSignerRoster.removedAt)));

  for (const r of rosterRows) {
    await ensureOnboardingProgressForRoster(orgId, r.id);
  }
}

// ─── Drill schedules ─────────────────────────────────────────────────────────

export async function getDrillSchedulesByOrg(orgId: string) {
  return db
    .select({
      schedule: emergencyDrillSchedules,
      safeName: safes.name,
      safeAddress: safes.address,
    })
    .from(emergencyDrillSchedules)
    .leftJoin(safes, eq(emergencyDrillSchedules.safeId, safes.id))
    .where(eq(emergencyDrillSchedules.orgId, orgId))
    .orderBy(emergencyDrillSchedules.nextDueAt);
}

export async function getDrillScheduleById(id: string) {
  const rows = await db
    .select()
    .from(emergencyDrillSchedules)
    .where(eq(emergencyDrillSchedules.id, id))
    .limit(1);
  return firstOrNull(rows);
}

export async function createDrillSchedule(data: {
  orgId: string;
  safeId?: string | null;
  drillType: string;
  cadence: string;
  title: string;
  ownerUserId?: string | null;
  nextDueAt?: Date | null;
}) {
  const nextDue =
    data.nextDueAt ?? computeNextDueAt(data.cadence as DrillCadence);
  const [row] = await db
    .insert(emergencyDrillSchedules)
    .values({
      orgId: data.orgId,
      safeId: data.safeId ?? null,
      drillType: data.drillType,
      cadence: data.cadence,
      title: data.title,
      ownerUserId: data.ownerUserId ?? null,
      nextDueAt: nextDue,
      isActive: true,
    })
    .returning();
  return firstOrNull([row]);
}

export async function updateDrillSchedule(
  id: string,
  data: Partial<{
    title: string;
    cadence: string;
    nextDueAt: Date | null;
    lastCompletedAt: Date | null;
    isActive: boolean;
    ownerUserId: string | null;
  }>
) {
  const [row] = await db
    .update(emergencyDrillSchedules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(emergencyDrillSchedules.id, id))
    .returning();
  return firstOrNull([row]);
}

export async function countOverdueDrillSchedules(orgId: string): Promise<number> {
  const schedules = await db
    .select()
    .from(emergencyDrillSchedules)
    .where(
      and(
        eq(emergencyDrillSchedules.orgId, orgId),
        eq(emergencyDrillSchedules.isActive, true)
      )
    );

  return schedules.filter((s) => isDrillOverdue(s.nextDueAt)).length;
}

export async function seedDefaultDrillSchedulesForOrg(orgId: string) {
  const criticalSafes = await db
    .select({ id: safes.id, name: safes.name })
    .from(safes)
    .where(
      and(
        eq(safes.orgId, orgId),
        eq(safes.classification, "protocol_critical")
      )
    );

  for (const safe of criticalSafes) {
    const [existing] = await db
      .select({ id: emergencyDrillSchedules.id })
      .from(emergencyDrillSchedules)
      .where(
        and(
          eq(emergencyDrillSchedules.orgId, orgId),
          eq(emergencyDrillSchedules.safeId, safe.id),
          eq(emergencyDrillSchedules.drillType, "tabletop")
        )
      )
      .limit(1);

    if (!existing) {
      await createDrillSchedule({
        orgId,
        safeId: safe.id,
        drillType: "tabletop",
        cadence: "quarterly",
        title: `Quarterly tabletop — ${safe.name ?? "Safe"}`,
      });
    }
  }
}

// ─── Drill runs ────────────────────────────────────────────────────────────────

export async function getDrillRunsByOrg(orgId: string, limit = 100) {
  return db
    .select({
      run: emergencyDrillRuns,
      safeName: safes.name,
    })
    .from(emergencyDrillRuns)
    .leftJoin(safes, eq(emergencyDrillRuns.safeId, safes.id))
    .where(eq(emergencyDrillRuns.orgId, orgId))
    .orderBy(desc(emergencyDrillRuns.completedAt), desc(emergencyDrillRuns.createdAt))
    .limit(limit);
}

export async function getDrillRunById(id: string) {
  const rows = await db
    .select()
    .from(emergencyDrillRuns)
    .where(eq(emergencyDrillRuns.id, id))
    .limit(1);
  return firstOrNull(rows);
}

export async function createDrillRun(data: {
  orgId: string;
  scheduleId?: string | null;
  safeId?: string | null;
  drillType: string;
  title: string;
  scheduledAt?: Date | null;
  completedAt?: Date | null;
  status: string;
  participantsJson?: unknown;
  findingsJson?: unknown;
  notes?: string | null;
  createdByUserId: string;
}) {
  const [row] = await db
    .insert(emergencyDrillRuns)
    .values({
      orgId: data.orgId,
      scheduleId: data.scheduleId ?? null,
      safeId: data.safeId ?? null,
      drillType: data.drillType,
      title: data.title,
      scheduledAt: data.scheduledAt ?? null,
      completedAt: data.completedAt ?? null,
      status: data.status,
      participantsJson: data.participantsJson as (typeof emergencyDrillRuns.$inferInsert)["participantsJson"],
      findingsJson: data.findingsJson as (typeof emergencyDrillRuns.$inferInsert)["findingsJson"],
      notes: data.notes ?? null,
      createdByUserId: data.createdByUserId,
    })
    .returning();

  if (data.scheduleId && data.status === "completed" && data.completedAt) {
    const schedule = await getDrillScheduleById(data.scheduleId);
    if (schedule) {
      await updateDrillSchedule(data.scheduleId, {
        lastCompletedAt: data.completedAt,
        nextDueAt: computeNextDueAt(schedule.cadence as DrillCadence, data.completedAt),
      });
    }
  }

  return firstOrNull([row]);
}

export async function updateDrillRun(
  id: string,
  data: Partial<{
    status: string;
    completedAt: Date | null;
    participantsJson: unknown;
    findingsJson: unknown;
    notes: string | null;
  }>
) {
  const [row] = await db
    .update(emergencyDrillRuns)
    .set({ ...data, updatedAt: new Date() } as typeof emergencyDrillRuns.$inferInsert)
    .where(eq(emergencyDrillRuns.id, id))
    .returning();
  return firstOrNull([row]);
}

export async function hasCompletedDrillType(
  orgId: string,
  drillType: string,
  withinDays: number,
  safeId?: string | null
): Promise<boolean> {
  const since = new Date(Date.now() - withinDays * 86400000);
  const conditions = [
    eq(emergencyDrillRuns.orgId, orgId),
    eq(emergencyDrillRuns.drillType, drillType),
    eq(emergencyDrillRuns.status, "completed"),
    gte(emergencyDrillRuns.completedAt, since),
  ];
  if (safeId) {
    conditions.push(eq(emergencyDrillRuns.safeId, safeId));
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emergencyDrillRuns)
    .where(and(...conditions));
  return (row?.count ?? 0) > 0;
}

export async function getLastCompletedDrill(orgId: string) {
  const rows = await db
    .select()
    .from(emergencyDrillRuns)
    .where(
      and(
        eq(emergencyDrillRuns.orgId, orgId),
        eq(emergencyDrillRuns.status, "completed")
      )
    )
    .orderBy(desc(emergencyDrillRuns.completedAt))
    .limit(1);
  return firstOrNull(rows);
}

// ─── Playbooks ─────────────────────────────────────────────────────────────────

export async function syncDefaultPlaybooks(orgId: string) {
  for (const def of CONVIXA_DEFAULT_PLAYBOOKS) {
    const [existing] = await db
      .select({ id: disasterRecoveryPlaybooks.id })
      .from(disasterRecoveryPlaybooks)
      .where(
        and(
          eq(disasterRecoveryPlaybooks.orgId, orgId),
          eq(disasterRecoveryPlaybooks.scenario, def.scenario),
          eq(disasterRecoveryPlaybooks.version, 1),
          eq(disasterRecoveryPlaybooks.isDefault, true)
        )
      )
      .limit(1);

    if (!existing) {
      await db.insert(disasterRecoveryPlaybooks).values({
        orgId,
        scope: "org",
        scenario: def.scenario,
        title: def.title,
        version: 1,
        contentMd: def.contentMd,
        isDefault: true,
      });
    }
  }
}

export async function getPlaybooksByOrg(orgId: string) {
  await syncDefaultPlaybooks(orgId);
  const rows = await db
    .select()
    .from(disasterRecoveryPlaybooks)
    .where(eq(disasterRecoveryPlaybooks.orgId, orgId))
    .orderBy(disasterRecoveryPlaybooks.scenario, desc(disasterRecoveryPlaybooks.version));

  const latestByScenario = new Map<string, (typeof rows)[0]>();
  for (const row of rows) {
    if (!latestByScenario.has(row.scenario)) {
      latestByScenario.set(row.scenario, row);
    }
  }
  return Array.from(latestByScenario.values());
}

export async function getPlaybookById(id: string) {
  const rows = await db
    .select()
    .from(disasterRecoveryPlaybooks)
    .where(eq(disasterRecoveryPlaybooks.id, id))
    .limit(1);
  return firstOrNull(rows);
}

export async function getPlaybookVersions(orgId: string, scenario: string) {
  return db
    .select()
    .from(disasterRecoveryPlaybooks)
    .where(
      and(
        eq(disasterRecoveryPlaybooks.orgId, orgId),
        eq(disasterRecoveryPlaybooks.scenario, scenario)
      )
    )
    .orderBy(desc(disasterRecoveryPlaybooks.version));
}

export async function publishPlaybookVersion(data: {
  orgId: string;
  scenario: string;
  title: string;
  contentMd: string;
  createdByUserId: string;
}) {
  const versions = await getPlaybookVersions(data.orgId, data.scenario);
  const nextVersion = (versions[0]?.version ?? 0) + 1;
  const [row] = await db
    .insert(disasterRecoveryPlaybooks)
    .values({
      orgId: data.orgId,
      scope: "org",
      scenario: data.scenario,
      title: data.title,
      version: nextVersion,
      contentMd: data.contentMd,
      isDefault: false,
      publishedAt: new Date(),
      createdByUserId: data.createdByUserId,
    })
    .returning();
  return firstOrNull([row]);
}

export async function countPublishedPlaybookScenarios(orgId: string): Promise<number> {
  await syncDefaultPlaybooks(orgId);
  const playbooks = await getPlaybooksByOrg(orgId);
  return playbooks.length;
}

export async function countStalePlaybooks(orgId: string, maxAgeDays = 365): Promise<number> {
  const playbooks = await getPlaybooksByOrg(orgId);
  const cutoff = Date.now() - maxAgeDays * 86400000;
  return playbooks.filter((p) => {
    const published = p.publishedAt ? new Date(p.publishedAt).getTime() : 0;
    return published < cutoff;
  }).length;
}

// ─── Readiness snapshots ───────────────────────────────────────────────────────

export async function saveReadinessSnapshot(orgId: string, metrics: Record<string, unknown>) {
  const [row] = await db
    .insert(readinessSnapshots)
    .values({ orgId, metricsJson: metrics })
    .returning();
  return firstOrNull([row]);
}

export async function getReadinessSnapshots(orgId: string, limit = 12) {
  return db
    .select()
    .from(readinessSnapshots)
    .where(eq(readinessSnapshots.orgId, orgId))
    .orderBy(desc(readinessSnapshots.computedAt))
    .limit(limit);
}
