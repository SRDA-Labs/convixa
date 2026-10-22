export type TxProposalAccessContext = {
  userId: string;
  isOrgAdmin: boolean;
  isTeamMember: boolean;
  isInvitedParticipant: boolean;
  threadStatus: string;
};

export function buildTxProposalAccessContext(
  userId: string,
  options: {
    isOrgAdmin: boolean;
    isTeamMember: boolean;
    isInvitedParticipant: boolean;
    threadStatus: string;
  }
): TxProposalAccessContext {
  return {
    userId,
    isOrgAdmin: options.isOrgAdmin,
    isTeamMember: options.isTeamMember,
    isInvitedParticipant: options.isInvitedParticipant,
    threadStatus: options.threadStatus,
  };
}

export function canViewTxProposal(ctx: TxProposalAccessContext): boolean {
  return ctx.isOrgAdmin || ctx.isTeamMember || ctx.isInvitedParticipant;
}

export function canStartTxProposal(ctx: TxProposalAccessContext): boolean {
  return ctx.isOrgAdmin || ctx.isTeamMember;
}

export function canCommentOnTxProposal(ctx: TxProposalAccessContext): boolean {
  return canViewTxProposal(ctx) && ctx.threadStatus === "open";
}

export function canInviteToTxProposal(ctx: TxProposalAccessContext): boolean {
  return ctx.isOrgAdmin || ctx.isTeamMember;
}

export function txProposalCapabilities(
  ctx: TxProposalAccessContext,
  options?: { threadExists: boolean }
) {
  const threadExists = options?.threadExists ?? true;
  return {
    canView: canViewTxProposal(ctx),
    canStart: canStartTxProposal(ctx) && !threadExists,
    canComment: threadExists ? canCommentOnTxProposal(ctx) : false,
    canInvite: threadExists ? canInviteToTxProposal(ctx) : false,
  };
}
