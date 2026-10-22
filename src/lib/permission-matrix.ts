import type { Permission } from "./permissions";

export type MatrixColumnId = "view" | "create" | "edit" | "delete";

export type MatrixColumn = {
  id: MatrixColumnId;
  label: string;
};

export const PERMISSION_MATRIX_COLUMNS: MatrixColumn[] = [
  { id: "view", label: "View" },
  { id: "create", label: "Create" },
  { id: "edit", label: "Edit" },
  { id: "delete", label: "Delete" },
];

export type MatrixCell = {
  permission: Permission;
  /** Shown on (i) hover — keep to one short line. */
  tooltip: string;
};

export type PermissionMatrixCategory = {
  id: string;
  /** UI section label (sidebar / area name). */
  category: string;
  cells: Partial<Record<MatrixColumnId, MatrixCell>>;
};

/** Category rows × action columns for the roles permission matrix. */
export const PERMISSION_MATRIX: PermissionMatrixCategory[] = [
  {
    id: "inventory",
    category: "Inventory & Safes",
    cells: {
      view: { permission: "safes:read", tooltip: "Open inventory and safe detail pages." },
      create: { permission: "safes:create", tooltip: "Add new Safe addresses to the org." },
      delete: { permission: "safes:delete", tooltip: "Remove Safes from the org inventory." },
    },
  },
  {
    id: "signer-queue",
    category: "Signer Queue",
    cells: {
      view: {
        permission: "signer:workflow",
        tooltip: "Use Signer Queue and complete pre-sign checklists.",
      },
    },
  },
  {
    id: "security",
    category: "Security Hub",
    cells: {
      view: {
        permission: "security:read",
        tooltip: "Readiness, drills, playbooks, OOB, incidents, and compliance views.",
      },
      edit: {
        permission: "security:manage",
        tooltip: "Edit templates, log drills, publish playbooks, update onboarding.",
      },
    },
  },
  {
    id: "teams",
    category: "Teams",
    cells: {
      view: { permission: "teams:read", tooltip: "View teams and team membership." },
      create: { permission: "teams:create", tooltip: "Create new teams." },
      edit: { permission: "teams:update", tooltip: "Rename teams and assign leads." },
      delete: { permission: "teams:delete", tooltip: "Delete teams." },
    },
  },
  {
    id: "invites",
    category: "Invites",
    cells: {
      view: { permission: "invites:read", tooltip: "View pending and past invites." },
      create: { permission: "invites:create", tooltip: "Create invite links." },
      delete: { permission: "invites:delete", tooltip: "Revoke or delete invites." },
    },
  },
  {
    id: "members",
    category: "Members",
    cells: {
      view: { permission: "members:read", tooltip: "View org members and assignments." },
      edit: { permission: "members:update", tooltip: "Change member roles and team placement." },
    },
  },
  {
    id: "roles",
    category: "Roles",
    cells: {
      view: { permission: "roles:read", tooltip: "View custom roles and permission sets." },
      create: { permission: "roles:create", tooltip: "Create new custom roles." },
      edit: { permission: "roles:update", tooltip: "Edit role names and permissions." },
      delete: { permission: "roles:delete", tooltip: "Delete custom roles." },
    },
  },
  {
    id: "export",
    category: "Data Export",
    cells: {
      view: { permission: "export:inventory", tooltip: "Download inventory and related CSV exports." },
      edit: {
        permission: "certification:export",
        tooltip: "Generate and download the SEAL certification export pack.",
      },
    },
  },
];

/** View/read permission required before manage/create/delete in the same area. */
const REQUIRES: Partial<Record<Permission, Permission>> = {
  "safes:create": "safes:read",
  "safes:delete": "safes:read",
  "teams:create": "teams:read",
  "teams:update": "teams:read",
  "teams:delete": "teams:read",
  "invites:create": "invites:read",
  "invites:delete": "invites:read",
  "members:update": "members:read",
  "roles:create": "roles:read",
  "roles:update": "roles:read",
  "roles:delete": "roles:read",
  "security:manage": "security:read",
  "certification:export": "security:read",
};

function dependentsOf(permission: Permission): Permission[] {
  return (Object.entries(REQUIRES) as [Permission, Permission][])
    .filter(([, req]) => req === permission)
    .map(([dep]) => dep);
}

export function toggleMatrixPermission(
  current: string[],
  permission: Permission,
  enabled: boolean
): string[] {
  const set = new Set(current);

  if (enabled) {
    set.add(permission);
    const required = REQUIRES[permission];
    if (required) set.add(required);
  } else {
    set.delete(permission);
    for (const dep of dependentsOf(permission)) {
      set.delete(dep);
    }
  }

  return [...set];
}

export function allMatrixPermissions(): Permission[] {
  const perms = new Set<Permission>();
  for (const row of PERMISSION_MATRIX) {
    for (const cell of Object.values(row.cells)) {
      if (cell) perms.add(cell.permission);
    }
  }
  return [...perms];
}
