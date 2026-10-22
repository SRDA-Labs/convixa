import { isOrgAdmin, getUserPermissions } from "@/lib/auth-server";
import {
  getSecurityIncidentById,
  isIncidentParticipant,
} from "@/lib/db/repositories/operational-workflows.repository";
import {
  buildIncidentAccessContext,
  canViewIncident,
  incidentCapabilities,
  type IncidentAccessContext,
} from "@/lib/incidents/access";
import type { securityIncidents } from "@/lib/db/schema/operational-workflows.schema";

type SecurityIncidentRow = typeof securityIncidents.$inferSelect;

export type ResolvedIncidentAccess = {
  incident: SecurityIncidentRow;
  access: IncidentAccessContext;
  capabilities: ReturnType<typeof incidentCapabilities>;
  canView: boolean;
};

export async function resolveIncidentAccess(
  incidentId: string,
  userId: string,
  orgId: string
): Promise<ResolvedIncidentAccess | null> {
  const incident = await getSecurityIncidentById(incidentId);
  if (!incident || incident.orgId !== orgId) {
    return null;
  }

  const [admin, permissions, participant] = await Promise.all([
    isOrgAdmin(orgId),
    getUserPermissions(orgId),
    isIncidentParticipant(incidentId, userId),
  ]);

  const access = buildIncidentAccessContext(userId, incident, {
    isOrgAdmin: admin,
    permissions,
    isParticipant: participant,
  });

  return {
    incident,
    access,
    capabilities: incidentCapabilities(access),
    canView: canViewIncident(access),
  };
}
