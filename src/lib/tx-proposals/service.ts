import { getDefaultTeams, isOrgAdmin } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { safes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getTxThreadById,
  getTxThreadBySafeTx,
  isTxThreadParticipant,
} from "@/lib/db/repositories/tx-proposals.repository";
import {
  buildTxProposalAccessContext,
  canViewTxProposal,
  txProposalCapabilities,
  type TxProposalAccessContext,
} from "@/lib/tx-proposals/access";
import type { pendingTxThreads } from "@/lib/db/schema/operational-workflows.schema";

type ThreadRow = typeof pendingTxThreads.$inferSelect;

export type ResolvedTxProposalAccess = {
  thread: ThreadRow | null;
  safe: {
    id: string;
    orgId: string;
    teamId: string;
    address: string;
    network: string;
    name: string | null;
  };
  access: TxProposalAccessContext;
  capabilities: ReturnType<typeof txProposalCapabilities>;
  canView: boolean;
};

async function isUserOnSafeTeam(userId: string, teamId: string, orgId: string) {
  const admin = await isOrgAdmin(orgId);
  if (admin) return true;
  const teams = await getDefaultTeams();
  return teams.some((t) => t.teamId === teamId);
}

export async function resolveTxProposalAccessByThread(
  threadId: string,
  userId: string,
  orgId: string
): Promise<ResolvedTxProposalAccess | null> {
  const thread = await getTxThreadById(threadId);
  if (!thread || thread.orgId !== orgId) return null;

  const [safe] = await db.select().from(safes).where(eq(safes.id, thread.safeId)).limit(1);
  if (!safe) return null;

  const [teamMember, participant, admin] = await Promise.all([
    isUserOnSafeTeam(userId, safe.teamId, orgId),
    isTxThreadParticipant(threadId, userId),
    isOrgAdmin(orgId),
  ]);

  const access = buildTxProposalAccessContext(userId, {
    isOrgAdmin: admin,
    isTeamMember: teamMember,
    isInvitedParticipant: participant,
    threadStatus: thread.status,
  });

  return {
    thread,
    safe: {
      id: safe.id,
      orgId: safe.orgId,
      teamId: safe.teamId,
      address: safe.address,
      network: safe.network,
      name: safe.name,
    },
    access,
    capabilities: txProposalCapabilities(access, { threadExists: true }),
    canView: canViewTxProposal(access),
  };
}

export async function resolveTxProposalAccessBySafeTx(
  safeId: string,
  safeTxHash: string,
  userId: string,
  orgId: string
): Promise<ResolvedTxProposalAccess | null> {
  const [safe] = await db.select().from(safes).where(eq(safes.id, safeId)).limit(1);
  if (!safe || safe.orgId !== orgId) return null;

  const thread = await getTxThreadBySafeTx(safeId, safeTxHash);

  const threadId = thread?.id;
  const [teamMember, participant, admin] = await Promise.all([
    isUserOnSafeTeam(userId, safe.teamId, orgId),
    threadId ? isTxThreadParticipant(threadId, userId) : Promise.resolve(false),
    isOrgAdmin(orgId),
  ]);

  const access = buildTxProposalAccessContext(userId, {
    isOrgAdmin: admin,
    isTeamMember: teamMember,
    isInvitedParticipant: participant,
    threadStatus: thread?.status ?? "open",
  });

  return {
    thread: thread ?? null,
    safe: {
      id: safe.id,
      orgId: safe.orgId,
      teamId: safe.teamId,
      address: safe.address,
      network: safe.network,
      name: safe.name,
    },
    access,
    capabilities: txProposalCapabilities(access, { threadExists: !!thread }),
    canView: thread ? canViewTxProposal(access) : teamMember || admin,
  };
}
