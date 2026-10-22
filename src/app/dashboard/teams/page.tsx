import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import {
  getDefaultOrgId,
  getDefaultTeams,
  isOrgAdmin,
  getTeamsUserLeads,
  hasPermission,
} from "@/lib/auth-server";
import { orgHubUrl } from "@/lib/org-management/constants";
import { OrgTabs, type OrgTab } from "./org-tabs";
import { TeamsTab } from "./teams-tab";
import { MembersTab } from "./members-tab";
import { InvitesTab } from "./invites-tab";
import { RolesTab } from "./roles-tab";
import { ProposalsTab } from "./proposals-tab";

function resolveTab(raw: string | undefined): OrgTab {
  if (raw === "proposals" || raw === "members" || raw === "invites" || raw === "roles") return raw;
  return "teams";
}

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const orgId = await getDefaultOrgId();
  if (!orgId) {
    return (
      <div className="min-w-0 space-y-6">
        <div className="border-b border-border pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground text-pretty">Teams</h1>
        </div>
        <p className="text-sm text-muted-foreground">No organization selected.</p>
        <Link href="/dashboard" className="text-xs text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const admin = await isOrgAdmin(orgId);
  const leadTeams = await getTeamsUserLeads(orgId);
  const isTeamLead = leadTeams.length > 0;
  const userTeams = await getDefaultTeams();

  const canAccessMembers = admin || isTeamLead;
  const canAccessInvites = admin || isTeamLead;
  const canAccessRoles = admin || (await hasPermission("roles:read", orgId));

  if (!admin && userTeams.length === 0) {
    return (
      <div className="min-w-0 space-y-6">
        <div className="border-b border-border pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground text-pretty">Teams</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You&apos;re not in any team yet. Ask your instance admin to add you or send an invite.
          </p>
        </div>
        <Link href="/dashboard" className="text-xs text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const { tab: tabParam, page: pageParam } = await searchParams;
  const tab = resolveTab(tabParam);
  const page = Math.max(1, Math.min(Number(pageParam) || 1, 999));

  const availableTabs: OrgTab[] = ["teams", "proposals"];
  if (canAccessMembers) availableTabs.push("members");
  if (canAccessInvites) availableTabs.push("invites");
  if (canAccessRoles) availableTabs.push("roles");

  if (!availableTabs.includes(tab)) {
    redirect(orgHubUrl(availableTabs[0]));
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="border-b border-border pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground text-pretty">Teams</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage teams, users, invitations, and multisig inventory for your self-hosted instance.
        </p>
      </div>

      <Suspense fallback={<div className="flex border-b border-border h-10" />}>
        <OrgTabs active={tab} tabs={availableTabs} />
      </Suspense>

      <div className="pt-2">
        {tab === "teams" && (
          <Suspense fallback={<p className="text-sm text-muted-foreground py-8">Loading teams…</p>}>
            <TeamsTab orgId={orgId} />
          </Suspense>
        )}
        {tab === "proposals" && (
          <Suspense fallback={<p className="text-sm text-muted-foreground py-8">Loading proposals…</p>}>
            <ProposalsTab />
          </Suspense>
        )}
        {tab === "members" && canAccessMembers && (
          <Suspense fallback={<p className="text-sm text-muted-foreground py-8">Loading members…</p>}>
            <MembersTab orgId={orgId} page={page} />
          </Suspense>
        )}
        {tab === "invites" && canAccessInvites && (
          <Suspense fallback={<p className="text-sm text-muted-foreground py-8">Loading invites…</p>}>
            <InvitesTab orgId={orgId} />
          </Suspense>
        )}
        {tab === "roles" && canAccessRoles && (
          <Suspense fallback={<p className="text-sm text-muted-foreground py-8">Loading roles…</p>}>
            <RolesTab orgId={orgId} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
