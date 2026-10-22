import { getDefaultOrgId, isOrgAdmin, getTeamsUserLeads, hasPermission } from "@/lib/auth-server";
import Link from "next/link";
import {
  Ban, UserCog, Fingerprint, ChevronRight, UserRoundCog,
} from "lucide-react";

interface SettingsItem {
  href: string;
  label: string;
  description: string;
  icon: typeof UserCog;
}

function SettingsRow({ href, icon: Icon, label, description }: SettingsItem) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-inset"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted group-hover:bg-muted/80 transition-colors">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" aria-hidden />
    </Link>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
      {label}
    </p>
  );
}

export default async function SettingsPage() {
  const orgId = await getDefaultOrgId();
  if (!orgId) {
    return (
      <p className="text-sm text-muted-foreground">No organization selected.</p>
    );
  }

  const admin = await isOrgAdmin(orgId);
  const leadTeams = await getTeamsUserLeads(orgId);
  const isTeamLead = leadTeams.length > 0;
  const canAccessInvites = admin || isTeamLead;
  const canAccessMembers = admin || isTeamLead;
  const canAccessRoles = admin || (await hasPermission("roles:read", orgId));

  const canAccessTeam = canAccessMembers || canAccessInvites || canAccessRoles;

  const personalItems: SettingsItem[] = [
    { href: "/dashboard/settings/general", label: "General", description: "Profile, wallet connection, and account details.", icon: UserCog },
    { href: "/dashboard/settings/security", label: "Security", description: "Two-factor authentication and active sessions.", icon: Fingerprint },
  ];

  const orgItems: SettingsItem[] = [];
  if (canAccessTeam) {
    orgItems.push({ href: "/dashboard/teams", label: "Teams & users", description: "Manage teams, members, invitations, roles, and multisig inventory.", icon: UserRoundCog });
  }
  if (admin) {
    orgItems.push({ href: "/dashboard/settings/blacklisted-addresses", label: "Blacklisted", description: "Manage blacklisted wallet addresses.", icon: Ban });
  }

  return (
    <div className="w-full">
      <section>
        <SectionHeader label="Personal" />
        <div className="mt-3 divide-y divide-border/60 rounded-xl border border-border/60 bg-card overflow-hidden">
          {personalItems.map((item) => (
            <SettingsRow key={item.href} {...item} />
          ))}
        </div>
      </section>

      {orgItems.length > 0 && (
        <section className="mt-8">
          <SectionHeader label="Organization" />
          <div className="mt-3 divide-y divide-border/60 rounded-xl border border-border/60 bg-card overflow-hidden">
            {orgItems.map((item) => (
              <SettingsRow key={item.href} {...item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
