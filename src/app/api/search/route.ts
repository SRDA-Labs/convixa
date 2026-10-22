import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  safes,
  teams,
  orgMembers,
  users,
  roles,
  alertRules,
} from "@/lib/db/schema";
import { eq, and, inArray, or, like } from "drizzle-orm";
import {
  getDefaultOrgId,
  getDefaultTeams,
  hasPermission,
  getOrgStatus,
} from "@/lib/auth-server";

/** Escape term for SQL LIKE: % and _ are wildcards. */
function likePattern(term: string): string {
  const escaped = term
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
  return `%${escaped}%`;
}

/** Nav items that can be suggested when query matches label. */
const NAV_ITEMS: { href: string; label: string; keywords: string[] }[] = [
  { href: "/dashboard", label: "Dashboard", keywords: ["dashboard", "overview"] },
  { href: "/dashboard/inventory", label: "Inventory", keywords: ["inventory", "safes", "list"] },
  { href: "/dashboard/alerts", label: "Alerts", keywords: ["alerts", "notifications"] },
  { href: "/dashboard/settings", label: "Settings", keywords: ["settings", "manage"] },
  { href: "/dashboard/teams?tab=invites", label: "Invites", keywords: ["invite", "invites", "invitation"] },
  { href: "/dashboard/teams?tab=roles", label: "Roles", keywords: ["role", "roles", "permissions"] },
  { href: "/dashboard/teams?tab=members", label: "Members", keywords: ["member", "members", "people", "team", "users"] },
  { href: "/dashboard/teams", label: "Teams", keywords: ["teams", "organization", "org"] },
  { href: "/dashboard/settings/profile", label: "User profile", keywords: ["profile", "user", "account"] },
];

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({
      safes: [],
      teams: [],
      members: [],
      roles: [],
      alertRules: [],
      nav: [],
    });
  }

  const orgId = await getDefaultOrgId();
  if (!orgId) {
    return NextResponse.json({
      safes: [],
      teams: [],
      members: [],
      roles: [],
      alertRules: [],
      nav: [],
    });
  }

  const pattern = likePattern(q);
  const results: {
    safes: Array<{ id: string; name: string | null; address: string; network: string; teamId: string; teamName: string }>;
    teams: Array<{ id: string; name: string; slug: string }>;
    members: Array<{ id: string; userId: string; email: string | null; name: string | null }>;
    roles: Array<{ id: string; name: string; slug: string }>;
    alertRules: Array<{ id: string; name: string | null; type: string; safeId: string | null }>;
    nav: Array<{ href: string; label: string }>;
  } = {
    safes: [],
    teams: [],
    members: [],
    roles: [],
    alertRules: [],
    nav: [],
  };

  const userTeams = await getDefaultTeams();
  const teamIds = userTeams.map((t) => t.teamId);

  // Safes: user's teams only; search name, address, network, notes, team name
  if (teamIds.length > 0) {
    const safeRows = await db
      .select({
        id: safes.id,
        name: safes.name,
        address: safes.address,
        network: safes.network,
        teamId: safes.teamId,
        teamName: teams.name,
      })
      .from(safes)
      .innerJoin(teams, eq(safes.teamId, teams.id))
      .where(
        and(
          inArray(safes.teamId, teamIds),
          or(
            like(safes.name, pattern),
            like(safes.address, pattern),
            like(safes.network, pattern),
            like(safes.notes, pattern),
            like(teams.name, pattern)
          )
        )
      )
      .limit(10);
    results.safes = safeRows.map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      network: r.network,
      teamId: r.teamId,
      teamName: r.teamName ?? "",
    }));
  }

  // Teams: only teams the user can see (their teams or all org when view-as)
  if (teamIds.length > 0) {
    const teamRows = await db
      .select({ id: teams.id, name: teams.name, slug: teams.slug })
      .from(teams)
      .where(
        and(
          eq(teams.orgId, orgId),
          inArray(teams.id, teamIds),
          or(like(teams.name, pattern), like(teams.slug, pattern))
        )
      )
      .limit(10);
    results.teams = teamRows.map((r) => ({ id: r.id, name: r.name, slug: r.slug }));
  }

  // Members: org members + users; need members:read
  const canReadMembers = await hasPermission("members:read", orgId);
  if (canReadMembers) {
    const memberRows = await db
      .select({
        id: orgMembers.id,
        userId: orgMembers.userId,
        email: users.email,
        name: users.name,
      })
      .from(orgMembers)
      .innerJoin(users, eq(orgMembers.userId, users.id))
      .where(
        and(
          eq(orgMembers.orgId, orgId),
          or(like(users.email, pattern), like(users.name, pattern))
        )
      )
      .limit(10);
    results.members = memberRows.map((r) => ({
      id: r.id,
      userId: r.userId,
      email: r.email ?? null,
      name: r.name ?? null,
    }));
  }

  // Roles: need roles:read
  const canReadRoles = await hasPermission("roles:read", orgId);
  if (canReadRoles) {
    const roleRows = await db
      .select({ id: roles.id, name: roles.name, slug: roles.slug })
      .from(roles)
      .where(
        and(
          eq(roles.orgId, orgId),
          or(like(roles.name, pattern), like(roles.slug, pattern))
        )
      )
      .limit(10);
    results.roles = roleRows.map((r) => ({ id: r.id, name: r.name, slug: r.slug }));
  }

  // Alert rules
  const ruleRows = await db
      .select({
        id: alertRules.id,
        name: alertRules.name,
        type: alertRules.type,
        safeId: alertRules.safeId,
      })
      .from(alertRules)
      .where(
        and(
          eq(alertRules.orgId, orgId),
          or(like(alertRules.name, pattern), like(alertRules.type, pattern))
        )
      )
      .limit(10);
    results.alertRules = ruleRows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      safeId: r.safeId,
    }));

  // Nav: match query against labels and keywords
  const qLower = q.toLowerCase();
  const navMatches = NAV_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(qLower) ||
      item.keywords.some((k) => k.includes(qLower) || qLower.includes(k))
  );
  results.nav = navMatches.map((item) => ({ href: item.href, label: item.label }));

  return NextResponse.json(results);
}
