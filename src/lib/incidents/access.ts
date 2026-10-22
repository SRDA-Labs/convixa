import type { Permission } from "@/lib/permissions";

export type IncidentAccessContext = {
  userId: string;
  isOrgAdmin: boolean;
  permissions: Permission[];
  isReporter: boolean;
  isParticipant: boolean;
};

export function buildIncidentAccessContext(
  userId: string,
  incident: { reporterUserId: string | null },
  options: {
    isOrgAdmin: boolean;
    permissions: Permission[];
    isParticipant: boolean;
  }
): IncidentAccessContext {
  return {
    userId,
    isOrgAdmin: options.isOrgAdmin,
    permissions: options.permissions,
    isReporter: incident.reporterUserId === userId,
    isParticipant: options.isParticipant,
  };
}

export function canViewIncident(ctx: IncidentAccessContext): boolean {
  return (
    ctx.isOrgAdmin ||
    ctx.permissions.includes("security:read") ||
    ctx.isParticipant
  );
}

export function canCommentOnIncident(ctx: IncidentAccessContext): boolean {
  return canViewIncident(ctx);
}

export function canInviteToIncident(ctx: IncidentAccessContext): boolean {
  return ctx.isOrgAdmin || ctx.isReporter;
}

export function canManageIncident(ctx: IncidentAccessContext): boolean {
  return (
    ctx.isOrgAdmin ||
    ctx.permissions.includes("security:manage") ||
    ctx.isReporter
  );
}

export function incidentCapabilities(ctx: IncidentAccessContext) {
  return {
    canView: canViewIncident(ctx),
    canComment: canCommentOnIncident(ctx),
    canInvite: canInviteToIncident(ctx),
    canManage: canManageIncident(ctx),
  };
}
