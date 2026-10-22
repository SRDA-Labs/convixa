import type { Permission } from "@/lib/permissions";

export type SecurityTab = {
  href: string;
  label: string;
  permission: Permission;
  /** Paths that belong to this tab in the subnav (drill-down pages without their own tab). */
  matchPaths?: string[];
};

/**
 * Primary Security hub tabs only — keep this list short.
 * Drill-down pages (onboarding, drills, playbooks, verification, exports) are
 * linked from Readiness tiles or in-page links, not top-level tabs.
 */
export const SECURITY_TABS: SecurityTab[] = [
  {
    href: "/dashboard/security/readiness",
    label: "Readiness",
    permission: "security:read",
    matchPaths: [
      "/dashboard/security/onboarding",
      "/dashboard/security/drills",
      "/dashboard/security/playbooks",
      "/dashboard/security/verification",
      "/dashboard/security/signer-overlap",
      "/dashboard/security/signer-activity",
      "/dashboard/security/roster-export",
    ],
  },
  {
    href: "/dashboard/security/pending-reviews",
    label: "Pending reviews",
    permission: "security:read",
    matchPaths: ["/dashboard/security/checklist-templates"],
  },
  {
    href: "/dashboard/security/oob-cases",
    label: "OOB cases",
    permission: "security:read",
  },
  {
    href: "/dashboard/security/incidents",
    label: "Incidents",
    permission: "security:read",
    matchPaths: ["/dashboard/security/incidents"],
  },
];

/** All security hub paths (tabs + drill-downs) for access checks. */
export const SECURITY_HUB_PATHS = [
  ...SECURITY_TABS.flatMap((t) => [t.href, ...(t.matchPaths ?? [])]),
  // Removed from nav — redirect to Readiness if visited directly
  "/dashboard/security/certification",
  "/dashboard/security/governance",
];

export function filterSecurityTabs(permissions: Permission[]): SecurityTab[] {
  const set = new Set(permissions);
  return SECURITY_TABS.filter((tab) => set.has(tab.permission));
}

export function canAccessSecurityHub(permissions: Permission[]): boolean {
  return permissions.includes("security:read");
}

export function canManageSecurity(permissions: Permission[]): boolean {
  return permissions.includes("security:manage");
}

export function canUseSignerWorkflow(permissions: Permission[]): boolean {
  return permissions.includes("signer:workflow");
}

function tabMatchesPath(tab: SecurityTab, pathname: string): boolean {
  if (pathname === tab.href || pathname.startsWith(tab.href + "/")) return true;
  return (tab.matchPaths ?? []).some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export function securityPathAllowed(pathname: string, permissions: Permission[]): boolean {
  if (!pathname.startsWith("/dashboard/security")) return true;
  const onHubPath = SECURITY_HUB_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (!onHubPath) return canAccessSecurityHub(permissions);
  return canAccessSecurityHub(permissions);
}

export function defaultSecurityLanding(permissions: Permission[]): string {
  const tabs = filterSecurityTabs(permissions);
  return tabs[0]?.href ?? "/dashboard";
}

export function activeSecurityTab(pathname: string, tabs: SecurityTab[]): string | null {
  for (const tab of tabs) {
    if (tabMatchesPath(tab, pathname)) return tab.href;
  }
  return null;
}
