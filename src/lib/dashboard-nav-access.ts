import type { Permission } from "@/lib/permissions";
import { canAccessSecurityHub, canUseSignerWorkflow } from "@/lib/security-access";

export type DashboardNavVisibility = {
  organization: {
    dashboard: boolean;
    inventory: boolean;
    alerts: boolean;
    teams: boolean;
    controls: boolean;
    security: boolean;
  };
  signer: {
    queue: boolean;
  };
};

const ORG_ADMIN_READ_PERMS: Permission[] = [
  "teams:read",
  "members:read",
  "invites:read",
  "roles:read",
];

function hasAny(permissions: Permission[], candidates: Permission[]): boolean {
  const set = new Set(permissions);
  return candidates.some((p) => set.has(p));
}

/**
 * Which primary nav entries the current user should see.
 * Organization = hosted instance / org-wide operations.
 * Signer = individual signing workflow (Signer Queue).
 */
export function getDashboardNavVisibility(
  permissions: Permission[],
  options?: { isOrgAdmin?: boolean; hasTeamMembership?: boolean }
): DashboardNavVisibility {
  const { isOrgAdmin = false, hasTeamMembership = false } = options ?? {};
  const canReadSafes = permissions.includes("safes:read");
  const showTeams =
    isOrgAdmin ||
    hasTeamMembership ||
    hasAny(permissions, ORG_ADMIN_READ_PERMS);

  return {
    organization: {
      dashboard: canReadSafes || canUseSignerWorkflow(permissions),
      inventory: canReadSafes,
      alerts: canReadSafes,
      teams: showTeams,
      controls: canReadSafes,
      security: canAccessSecurityHub(permissions),
    },
    signer: {
      queue: canUseSignerWorkflow(permissions),
    },
  };
}

export function hasOrganizationNavItems(visibility: DashboardNavVisibility): boolean {
  return Object.values(visibility.organization).some(Boolean);
}

export function hasSignerNavItems(visibility: DashboardNavVisibility): boolean {
  return Object.values(visibility.signer).some(Boolean);
}
