/**
 * Transaction proposal threads — team-scoped discussion records for queued txs.
 */

import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { db } from "../index";
import {
  pendingTxThreads,
  pendingTxThreadComments,
  pendingTxThreadActivity,
  pendingTxThreadParticipants,
  safes,
} from "../schema";
import { teams } from "../schema/teams.schema";
import { users } from "../schema/users.schema";
import { firstOrNull } from "../utils/queries";
import { normalizeSafeTxHash } from "./operational-workflows.repository";
import type { TxSnapshot } from "../schema/operational-workflows.schema";

// ─── Threads ─────────────────────────────────────────────────────────────────

export async function getTxThreadById(id: string) {
  const rows = await db
    .select()
    .from(pendingTxThreads)
    .where(eq(pendingTxThreads.id, id))
    .limit(1);
  return firstOrNull(rows);
}

export async function getTxThreadBySafeTx(safeId: string, safeTxHash: string) {
  const hash = normalizeSafeTxHash(safeTxHash);
  const rows = await db
    .select()
    .from(pendingTxThreads)
    .where(
      and(eq(pendingTxThreads.safeId, safeId), eq(pendingTxThreads.safeTxHash, hash))
    )
    .limit(1);
  return firstOrNull(rows);
}

export async function createTxThread(data: {
  orgId: string;
  safeId: string;
  safeTxHash: string;
  openedByUserId: string;
  txSnapshot: TxSnapshot;
}) {
  const hash = normalizeSafeTxHash(data.safeTxHash);
  const now = new Date();
  const [row] = await db
    .insert(pendingTxThreads)
    .values({
      orgId: data.orgId,
      safeId: data.safeId,
      safeTxHash: hash,
      status: "open",
      txSnapshot: data.txSnapshot,
      openedByUserId: data.openedByUserId,
      lastActivityAt: now,
      commentCount: 0,
    })
    .returning();
  return firstOrNull([row]);
}

export async function updateTxThreadStatus(
  id: string,
  data: Partial<{
    status: string;
    executedAt: Date | null;
    txSnapshot: TxSnapshot;
    lastActivityAt: Date;
  }>
) {
  const [row] = await db
    .update(pendingTxThreads)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(pendingTxThreads.id, id))
    .returning();
  return firstOrNull([row]);
}

export async function touchTxThreadActivity(threadId: string) {
  await db
    .update(pendingTxThreads)
    .set({ lastActivityAt: new Date(), updatedAt: new Date() })
    .where(eq(pendingTxThreads.id, threadId));
}

export async function incrementTxThreadCommentCount(threadId: string) {
  await db
    .update(pendingTxThreads)
    .set({
      commentCount: sql`${pendingTxThreads.commentCount} + 1`,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(pendingTxThreads.id, threadId));
}

export async function listTxThreadsByTeams(
  orgId: string,
  teamIds: string[],
  options?: { status?: string; teamId?: string; limit?: number }
) {
  if (teamIds.length === 0) return [];

  const safeTeamFilter = options?.teamId
    ? teamIds.includes(options.teamId)
      ? [options.teamId]
      : []
    : teamIds;
  if (safeTeamFilter.length === 0) return [];

  const conditions = [
    eq(pendingTxThreads.orgId, orgId),
    inArray(safes.teamId, safeTeamFilter),
  ];
  if (options?.status) {
    conditions.push(eq(pendingTxThreads.status, options.status));
  }

  return db
    .select({
      id: pendingTxThreads.id,
      orgId: pendingTxThreads.orgId,
      safeId: pendingTxThreads.safeId,
      safeTxHash: pendingTxThreads.safeTxHash,
      status: pendingTxThreads.status,
      txSnapshot: pendingTxThreads.txSnapshot,
      commentCount: pendingTxThreads.commentCount,
      lastActivityAt: pendingTxThreads.lastActivityAt,
      openedByUserId: pendingTxThreads.openedByUserId,
      createdAt: pendingTxThreads.createdAt,
      executedAt: pendingTxThreads.executedAt,
      safeName: safes.name,
      safeAddress: safes.address,
      network: safes.network,
      teamId: safes.teamId,
      teamName: teams.name,
      openerName: users.name,
      openerEmail: users.email,
    })
    .from(pendingTxThreads)
    .innerJoin(safes, eq(pendingTxThreads.safeId, safes.id))
    .innerJoin(teams, eq(safes.teamId, teams.id))
    .leftJoin(users, eq(pendingTxThreads.openedByUserId, users.id))
    .where(and(...conditions))
    .orderBy(desc(pendingTxThreads.lastActivityAt), desc(pendingTxThreads.createdAt))
    .limit(options?.limit ?? 100);
}

export async function getTxThreadHashesForSafes(safeIds: string[]) {
  if (safeIds.length === 0) return new Set<string>();
  const rows = await db
    .select({
      safeId: pendingTxThreads.safeId,
      safeTxHash: pendingTxThreads.safeTxHash,
    })
    .from(pendingTxThreads)
    .where(inArray(pendingTxThreads.safeId, safeIds));
  return new Set(rows.map((r) => `${r.safeId}:${r.safeTxHash}`));
}

export async function listInvitedThreadIdsForUser(userId: string, orgId: string) {
  const rows = await db
    .select({ threadId: pendingTxThreadParticipants.threadId })
    .from(pendingTxThreadParticipants)
    .innerJoin(pendingTxThreads, eq(pendingTxThreadParticipants.threadId, pendingTxThreads.id))
    .where(
      and(
        eq(pendingTxThreadParticipants.userId, userId),
        eq(pendingTxThreads.orgId, orgId)
      )
    );
  return rows.map((r) => r.threadId);
}

export async function listInvitedThreadsForUser(userId: string, orgId: string) {
  const threadIds = await listInvitedThreadIdsForUser(userId, orgId);
  if (threadIds.length === 0) return [];

  return db
    .select({
      id: pendingTxThreads.id,
      orgId: pendingTxThreads.orgId,
      safeId: pendingTxThreads.safeId,
      safeTxHash: pendingTxThreads.safeTxHash,
      status: pendingTxThreads.status,
      txSnapshot: pendingTxThreads.txSnapshot,
      commentCount: pendingTxThreads.commentCount,
      lastActivityAt: pendingTxThreads.lastActivityAt,
      openedByUserId: pendingTxThreads.openedByUserId,
      createdAt: pendingTxThreads.createdAt,
      executedAt: pendingTxThreads.executedAt,
      safeName: safes.name,
      safeAddress: safes.address,
      network: safes.network,
      teamId: safes.teamId,
      teamName: teams.name,
      openerName: users.name,
      openerEmail: users.email,
    })
    .from(pendingTxThreads)
    .innerJoin(safes, eq(pendingTxThreads.safeId, safes.id))
    .innerJoin(teams, eq(safes.teamId, teams.id))
    .leftJoin(users, eq(pendingTxThreads.openedByUserId, users.id))
    .where(
      and(eq(pendingTxThreads.orgId, orgId), inArray(pendingTxThreads.id, threadIds))
    )
    .orderBy(desc(pendingTxThreads.lastActivityAt));
}

// ─── Comments ────────────────────────────────────────────────────────────────

export async function addTxThreadComment(data: {
  threadId: string;
  userId: string;
  body: string;
}) {
  const [row] = await db.insert(pendingTxThreadComments).values(data).returning();
  return firstOrNull([row]);
}

export async function getTxThreadCommentsWithUsers(threadId: string) {
  return db
    .select({
      id: pendingTxThreadComments.id,
      threadId: pendingTxThreadComments.threadId,
      userId: pendingTxThreadComments.userId,
      body: pendingTxThreadComments.body,
      createdAt: pendingTxThreadComments.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(pendingTxThreadComments)
    .innerJoin(users, eq(pendingTxThreadComments.userId, users.id))
    .where(eq(pendingTxThreadComments.threadId, threadId))
    .orderBy(pendingTxThreadComments.createdAt);
}

// ─── Activity ────────────────────────────────────────────────────────────────

export async function logTxThreadActivity(data: {
  threadId: string;
  userId?: string | null;
  action: string;
  summary: string;
  metadata?: Record<string, unknown> | null;
}) {
  const [row] = await db
    .insert(pendingTxThreadActivity)
    .values({
      threadId: data.threadId,
      userId: data.userId ?? null,
      action: data.action,
      summary: data.summary,
      metadata: data.metadata ?? null,
    })
    .returning();
  await touchTxThreadActivity(data.threadId);
  return firstOrNull([row]);
}

export async function getTxThreadActivity(threadId: string, limit = 50) {
  return db
    .select({
      id: pendingTxThreadActivity.id,
      threadId: pendingTxThreadActivity.threadId,
      userId: pendingTxThreadActivity.userId,
      action: pendingTxThreadActivity.action,
      summary: pendingTxThreadActivity.summary,
      metadata: pendingTxThreadActivity.metadata,
      createdAt: pendingTxThreadActivity.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(pendingTxThreadActivity)
    .leftJoin(users, eq(pendingTxThreadActivity.userId, users.id))
    .where(eq(pendingTxThreadActivity.threadId, threadId))
    .orderBy(desc(pendingTxThreadActivity.createdAt))
    .limit(limit);
}

// ─── Participants ────────────────────────────────────────────────────────────

export async function addTxThreadParticipant(data: {
  threadId: string;
  userId: string;
  invitedByUserId?: string | null;
  role?: string;
}) {
  const [row] = await db
    .insert(pendingTxThreadParticipants)
    .values({
      threadId: data.threadId,
      userId: data.userId,
      role: data.role ?? "collaborator",
      invitedByUserId: data.invitedByUserId ?? null,
    })
    .onConflictDoNothing()
    .returning();
  return firstOrNull([row]);
}

export async function isTxThreadParticipant(threadId: string, userId: string) {
  const rows = await db
    .select({ id: pendingTxThreadParticipants.id })
    .from(pendingTxThreadParticipants)
    .where(
      and(
        eq(pendingTxThreadParticipants.threadId, threadId),
        eq(pendingTxThreadParticipants.userId, userId)
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function getTxThreadParticipants(threadId: string) {
  return db
    .select({
      id: pendingTxThreadParticipants.id,
      userId: pendingTxThreadParticipants.userId,
      role: pendingTxThreadParticipants.role,
      invitedByUserId: pendingTxThreadParticipants.invitedByUserId,
      createdAt: pendingTxThreadParticipants.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(pendingTxThreadParticipants)
    .innerJoin(users, eq(pendingTxThreadParticipants.userId, users.id))
    .where(eq(pendingTxThreadParticipants.threadId, threadId))
    .orderBy(pendingTxThreadParticipants.createdAt);
}

export async function getTxThreadDetail(threadId: string) {
  const rows = await db
    .select({
      thread: pendingTxThreads,
      safeName: safes.name,
      safeAddress: safes.address,
      network: safes.network,
      teamId: safes.teamId,
      teamName: teams.name,
      classification: safes.classification,
      openerName: users.name,
      openerEmail: users.email,
    })
    .from(pendingTxThreads)
    .innerJoin(safes, eq(pendingTxThreads.safeId, safes.id))
    .innerJoin(teams, eq(safes.teamId, teams.id))
    .leftJoin(users, eq(pendingTxThreads.openedByUserId, users.id))
    .where(eq(pendingTxThreads.id, threadId))
    .limit(1);
  const row = firstOrNull(rows);
  if (!row) return null;
  return {
    ...row.thread,
    safeName: row.safeName,
    safeAddress: row.safeAddress,
    network: row.network,
    teamId: row.teamId,
    teamName: row.teamName,
    classification: row.classification,
    openerName: row.openerName,
    openerEmail: row.openerEmail,
  };
}
