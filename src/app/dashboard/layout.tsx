import { redirect } from "next/navigation";
import {
  getSession,
  getDefaultOrgId,
  getCurrentUserOrgs,
  getOrgName,
  getOrgSlug,
  getDefaultTeams,
  getUserPermissions,
  isOrgAdmin,
} from "@/lib/auth-server";
import { getDashboardNavVisibility } from "@/lib/dashboard-nav-access";
import { ensureDefaultOrgForUser } from "@/lib/org-bootstrap";
import { countSafesByOrg } from "@/lib/db/repositories";
import { DashboardNav } from "@/components/dashboard-nav";
import { AddSafeModalProvider } from "@/components/add-safe-modal-provider";
import { Breadcrumb } from "@/components/breadcrumb";
import { OrgSwitcherCompact } from "@/components/org-switcher-compact";
import { CommandPaletteTrigger } from "@/components/command-palette-trigger";
import { DashboardHeaderRight } from "@/components/dashboard-header-right";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { DashboardSearchBar } from "@/components/dashboard-search-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardPageShell } from "@/components/dashboard-page-shell";
import { Shield } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const userId = (session.user as { id?: string }).id;
  let orgId = await getDefaultOrgId();
  if (!orgId && userId) {
    orgId = await ensureDefaultOrgForUser(userId);
  }
  if (!orgId) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const orgsList = await getCurrentUserOrgs();

  const [orgName, orgSlug, safeCount, userTeams, permissions, admin] = await Promise.all([
    getOrgName(orgId),
    getOrgSlug(orgId),
    countSafesByOrg(orgId),
    getDefaultTeams(),
    getUserPermissions(orgId),
    isOrgAdmin(orgId),
  ]);
  const navVisibility = getDashboardNavVisibility(permissions, {
    isOrgAdmin: admin,
    hasTeamMembership: userTeams.length > 0,
  });
  const teamNames = userTeams.map((t) => t.teamName);
  const displayOrgName = orgsList.find((o) => o.orgId === orgId)?.orgName ?? orgName ?? "Organization";
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "v3.1.0-community";

  return (
    <AddSafeModalProvider>
      <KeyboardShortcuts />
      <div className="hidden" aria-hidden>
        <DashboardSearchBar />
      </div>
      <div className="min-h-screen bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:outline-none"
        >
          Skip to content
        </a>
        <aside className="fixed left-0 top-0 bottom-0 z-20 w-14 border-r border-border bg-background flex flex-col group peer hover:w-52 transition-all duration-200">
          <div className="h-16 flex items-center justify-center group-hover:justify-start group-hover:px-4 shrink-0">
            <a
              href="/dashboard"
              aria-label="Convixa dashboard"
              className="flex items-center justify-center gap-2.5 size-8 group-hover:w-auto group-hover:h-auto group-hover:px-3 group-hover:py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all duration-200"
            >
              <Shield className="h-4 w-4 shrink-0 mx-auto group-hover:mx-0" aria-hidden />
              <span className="hidden group-hover:inline text-sm font-bold tracking-tight whitespace-nowrap pr-2">CONVIXA</span>
            </a>
          </div>
          <DashboardNav
            orgName={displayOrgName}
            currentOrgId={orgId}
            orgs={orgsList.map((o) => ({ orgId: o.orgId, orgName: o.orgName, role: o.role }))}
            teamNames={teamNames.length > 0 ? teamNames : undefined}
            navVisibility={navVisibility}
          />
        </aside>
        <div
          className="fixed left-14 top-0 right-0 bottom-0 z-[15] bg-background/40 backdrop-blur-sm opacity-0 peer-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          aria-hidden
        />
        <main id="main-content" className="flex flex-col min-h-screen min-w-0 ml-14">
          <div className="sticky top-0 z-10 shrink-0 h-14 border-b border-border-subtle bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <OrgSwitcherCompact
                currentOrgId={orgId}
                currentOrgName={displayOrgName}
                orgs={orgsList.map((o) => ({ orgId: o.orgId, orgName: o.orgName, role: o.role }))}
              />
              <span className="h-4 w-px bg-border shrink-0" aria-hidden />
              <Breadcrumb />
            </div>
            <div className="flex items-center gap-2">
              <CommandPaletteTrigger />
              <DashboardHeaderRight />
            </div>
          </div>
          <div className="flex-1 overflow-auto py-6 min-h-0 relative">
            <DashboardPageShell>{children}</DashboardPageShell>
          </div>
          <footer className="h-8 shrink-0 flex items-center justify-between px-4 border-t border-border-subtle bg-card text-[10px]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                <span className="text-text-tertiary uppercase font-bold tracking-tighter">Nodes Healthy</span>
              </div>
              <span className="font-mono text-text-tertiary">Org ID: {orgSlug ?? "—"}</span>
            </div>
            <div className="flex items-center gap-3 text-text-tertiary">
              <span>{safeCount} Safes</span>
              <span>{appVersion}</span>
            </div>
          </footer>
        </main>
        <ThemeToggle className="bottom-10" />
      </div>
    </AddSafeModalProvider>
  );
}
