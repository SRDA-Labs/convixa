/**
 * Permission slugs used for role-based access.
 * Admin (org_members.role === 'admin') has all permissions implicitly.
 *
 * Security hub and signer workflow use custom roles (default Signer / Security Lead seeded per org).
 * Default permission sets (enforced via getUserPermissions / isOrgAdmin / isTeamLead in auth-server):
 * - Org Admin: full org access (all permissions).
 * - Team Lead: team-scoped — add/remove safes in their team(s), invite to their team(s), add/remove members from their team(s); view invites and members for their team(s).
 * - Member: read-only — safes:read for safes in their team(s) only.
 */
export const PERMISSIONS = [
  "safes:read",
  "safes:create",
  "safes:delete",
  "teams:read",
  "teams:create",
  "teams:update",
  "teams:delete",
  "invites:read",
  "invites:create",
  "invites:delete",
  "roles:read",
  "roles:create",
  "roles:update",
  "roles:delete",
  "members:read",
  "members:update",
  "export:inventory",
  "signer:workflow",
  "security:read",
  "security:manage",
  "certification:export",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  "safes:read": "View Safes",
  "safes:create": "Add Safes",
  "safes:delete": "Remove Safes",
  "teams:read": "View Teams",
  "teams:create": "Create Teams",
  "teams:update": "Edit Teams",
  "teams:delete": "Delete Teams",
  "invites:read": "View Invites",
  "invites:create": "Create Invites",
  "invites:delete": "Delete Invites",
  "roles:read": "View Roles",
  "roles:create": "Create Roles",
  "roles:update": "Edit Roles",
  "roles:delete": "Delete Roles",
  "members:read": "View Members",
  "members:update": "Assign Roles to Members",
  "export:inventory": "Export Inventory CSV",
  "signer:workflow": "Signer Queue & Pre-sign Reviews",
  "security:read": "View Security Hub",
  "security:manage": "Manage Security Hub",
  "certification:export": "Export SEAL Certification Pack",
};

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  "safes:read": "Allows the user to view all transaction history and assets.",
  "safes:create": "Add new Safe addresses to the organization inventory.",
  "safes:delete": "Remove Safe addresses from the organization inventory.",
  "teams:read": "View teams and their members within the organization.",
  "teams:create": "Create new teams and assign leads.",
  "teams:update": "Edit team names and assign team leads.",
  "teams:delete": "Delete teams and manage membership.",
  "invites:read": "View pending and past invite links.",
  "invites:create": "Create new invite links for members.",
  "invites:delete": "Revoke or delete invite links.",
  "roles:read": "View custom roles and their permissions.",
  "roles:create": "Create new custom roles with permission sets.",
  "roles:update": "Edit role names and permissions.",
  "roles:delete": "Delete custom roles.",
  "members:read": "View organization members and their roles.",
  "members:update": "Assign or change roles for other members.",
  "export:inventory": "Export Safe inventory and data to CSV.",
  "signer:workflow":
    "Access Signer Queue and complete pre-sign checklists. Does not include org-wide Security hub administration.",
  "security:read":
    "View Security hub: readiness, drills, playbooks, OOB cases, compliance exports, and org-wide onboarding status.",
  "security:manage":
    "Edit checklist templates, log drills, publish playbooks, and update signer onboarding progress for the org.",
  "certification:export":
    "Download the full SEAL certification export pack for auditors and governance reviews.",
};

/** Default permission sets (documentation). Enforcement is via isOrgAdmin / isTeamLead / canManageTeam in auth-server. */
export const DEFAULT_PERMISSION_SETS = {
  org_admin: {
    label: "Org Admin",
    description: "Full org access: add/remove users, create teams, assign team leads, manage all invites and join requests, roles, members, and safes.",
    permissions: ["all"] as const,
  },
  team_lead: {
    label: "Team Lead",
    description: "Manage their team(s): add/remove safes, invite to team, add/remove members from team. View invites and members for their team(s).",
    permissions: ["safes:read", "safes:create", "safes:delete", "invites:read", "invites:create", "invites:delete", "members:read"] as const,
  },
  member: {
    label: "Member",
    description:
      "Baseline member without a custom role: view team safes and Signer Queue. Assign the Signer or Security Lead custom role for explicit access control.",
    permissions: ["safes:read", "signer:workflow"] as const,
  },
  signer: {
    label: "Signer (custom role)",
    description:
      "View assigned Safes and Signer Queue only. No Security hub readiness, drills, or org onboarding admin.",
    permissions: ["safes:read", "signer:workflow"] as const,
  },
  security_lead: {
    label: "Security Lead (custom role)",
    description: "Full Security hub read/manage plus Signer Queue and inventory export.",
    permissions: [
      "safes:read",
      "signer:workflow",
      "security:read",
      "security:manage",
      "export:inventory",
      "certification:export",
    ] as const,
  },
} as const;

/** Permissions granted to org members with role=member and no custom roleId (legacy baseline). */
export const BASELINE_MEMBER_PERMISSIONS: Permission[] = ["safes:read", "signer:workflow"];
