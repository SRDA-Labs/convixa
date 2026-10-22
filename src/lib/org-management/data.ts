import { isOrgAdmin, getTeamsUserLeads, hasPermission } from "@/lib/auth-server";
import { db } from "@/lib/db";
import {
  orgMembers,
  users,
  roles,
  teamMembers,
  teams,
  invites,
} from "@/lib/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import type { InviteRow } from "@/app/dashboard/settings/invites/invites-client";
import { syncDefaultOrgRoles, descriptionForDefaultSlug } from "@/lib/default-roles";

export const ORG_PAGE_SIZE = 10;

function shortInviteId(id: string): string {
  return `inv-${id.replace(/-/g, "").slice(-6)}`;
}

function descriptionForSlug(slug: string, name: string): string {
  const defaultDesc = descriptionForDefaultSlug(slug, name);
  if (defaultDesc) return defaultDesc;
  const lower = slug.toLowerCase();
  if (lower.includes("viewer")) return "Read-only access to transaction logs, inventory, and dashboards.";
  if (lower.includes("auditor")) return "Access to compliance reports and historical signing records.";
  return `Custom role: ${name}.`;
}

export async function fetchMemberData(orgId: string) {
  const admin = await isOrgAdmin(orgId);
  const leadTeams = await getTeamsUserLeads(orgId);
  const leadTeamIds = new Set(leadTeams.map((t) => t.teamId));
  const canUpdate = await hasPermission("members:update", orgId);

  const list = await db
    .select({
      id: orgMembers.id,
      userId: orgMembers.userId,
      role: orgMembers.role,
      roleId: orgMembers.roleId,
      email: users.email,
      name: users.name,
      roleName: roles.name,
      linkedWalletAddress: users.linkedWalletAddress,
    })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .leftJoin(roles, eq(orgMembers.roleId, roles.id))
    .where(eq(orgMembers.orgId, orgId))
    .orderBy(orgMembers.createdAt);

  const orgRoles = await db
    .select({ id: roles.id, name: roles.name })
    .from(roles)
    .where(eq(roles.orgId, orgId))
    .orderBy(roles.name);

  const teamRows = await db
    .select({ userId: teamMembers.userId, teamId: teams.id, teamName: teams.name })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teams.orgId, orgId));

  const userIdToTeams = new Map<string, { teamId: string; teamName: string }[]>();
  for (const row of teamRows) {
    const arr = userIdToTeams.get(row.userId) ?? [];
    arr.push({ teamId: row.teamId, teamName: row.teamName });
    userIdToTeams.set(row.userId, arr);
  }

  const teamsList = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.orgId, orgId));

  const manageableTeams = admin
    ? teamsList.map((t) => ({ teamId: t.id, teamName: t.name }))
    : leadTeams;

  const members = list.map((m) => {
    const memberTeams = userIdToTeams.get(m.userId) ?? [];
    const removableTeams = memberTeams.filter((t) => admin || leadTeamIds.has(t.teamId));
    const memberTeamIds = new Set(memberTeams.map((t) => t.teamId));
    const addableTeams = manageableTeams.filter((t) => !memberTeamIds.has(t.teamId));
    return {
      id: m.id,
      userId: m.userId,
      email: m.email ?? "",
      name: m.name ?? null,
      role: m.role as "owner" | "admin" | "member",
      roleId: m.roleId ?? null,
      roleName: m.roleName ?? null,
      teams: memberTeams,
      removableTeams,
      addableTeams,
    };
  });

  return { members, orgRoles, canUpdate, admin, leadTeamIds };
}

export async function fetchInviteData(orgId: string) {
  const admin = await isOrgAdmin(orgId);
  const leadTeams = await getTeamsUserLeads(orgId);
  const leadTeamIds = new Set(leadTeams.map((t) => t.teamId));
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const list = await db
    .select({
      id: invites.id,
      email: invites.email,
      teamId: invites.teamId,
      role: invites.role,
      expiresAt: invites.expiresAt,
      status: invites.status,
      createdAt: invites.createdAt,
      teamName: teams.name,
      creatorName: users.name,
    })
    .from(invites)
    .leftJoin(teams, eq(invites.teamId, teams.id))
    .leftJoin(users, eq(invites.createdByUserId, users.id))
    .where(eq(invites.orgId, orgId))
    .orderBy(desc(invites.createdAt));

  const listFiltered = admin ? list : list.filter((i) => i.teamId && leadTeamIds.has(i.teamId));
  const now = new Date();

  const activeInvites: InviteRow[] = listFiltered
    .filter((i) => i.status === "pending" && new Date(i.expiresAt) > now)
    .map((i) => ({
      id: i.id,
      shortId: shortInviteId(i.id),
      email: i.email,
      teamId: i.teamId,
      teamName: i.teamName ?? null,
      role: i.role,
      expiresAt: new Date(i.expiresAt),
      status: i.status,
      createdAt: new Date(i.createdAt),
      creatorName: i.creatorName ?? null,
    }));

  const historyInvites: InviteRow[] = listFiltered
    .filter((i) => (i.status === "accepted" || i.status === "expired") && new Date(i.createdAt) >= thirtyDaysAgo)
    .map((i) => ({
      id: i.id,
      shortId: shortInviteId(i.id),
      email: i.email,
      teamId: i.teamId,
      teamName: i.teamName ?? null,
      role: i.role,
      expiresAt: new Date(i.expiresAt),
      status: i.status,
      createdAt: new Date(i.createdAt),
      creatorName: i.creatorName ?? null,
    }));

  const teamsList = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.orgId, orgId));

  const teamsForSelect = admin
    ? teamsList.map((t) => ({ teamId: t.id, teamName: t.name }))
    : teamsList.filter((t) => leadTeamIds.has(t.id)).map((t) => ({ teamId: t.id, teamName: t.name }));

  return { activeInvites, historyInvites, teamsForSelect };
}

export async function fetchRolesData(orgId: string) {
  await syncDefaultOrgRoles(orgId);
  const canCreate = await hasPermission("roles:create", orgId);
  const canUpdate = await hasPermission("roles:update", orgId);
  const canDelete = await hasPermission("roles:delete", orgId);

  const customRoles = await db.select().from(roles).where(eq(roles.orgId, orgId)).orderBy(roles.createdAt);

  const [adminCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, "admin")));

  const [ownerCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, "owner")));

  const adminMembers = await db
    .select({ userId: users.id, name: users.name, email: users.email })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(and(eq(orgMembers.orgId, orgId), sql`${orgMembers.role} IN ('admin', 'owner')`))
    .limit(4);

  const roleCounts =
    customRoles.length > 0
      ? await db
          .select({ roleId: orgMembers.roleId, count: sql<number>`count(*)::int` })
          .from(orgMembers)
          .where(eq(orgMembers.orgId, orgId))
          .groupBy(orgMembers.roleId)
      : [];

  const countByRoleId = new Map<string, number>();
  for (const row of roleCounts) {
    if (row.roleId) countByRoleId.set(row.roleId, row.count);
  }

  const rolesWithPerms = customRoles.map((r) => {
    let perms: string[] = [];
    try {
      perms = JSON.parse(typeof r.permissions === "string" ? r.permissions : JSON.stringify(r.permissions ?? "[]")) as string[];
    } catch {
      /* ignore */
    }
    return {
      id: r.id,
      orgId: r.orgId,
      name: r.name,
      slug: r.slug,
      permissions: perms,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });

  const systemRow = {
    type: "system" as const,
    id: "admin",
    name: "Administrator",
    description: "Full access to all resources and management settings including user permissions.",
    memberCount: (adminCountResult?.count ?? 0) + (ownerCountResult?.count ?? 0),
    memberPreviews: adminMembers.slice(0, 3).map((m) => ({ name: m.name ?? null, email: m.email ?? "" })),
  };

  const customRows = rolesWithPerms.map((r) => ({
    ...r,
    type: "custom" as const,
    description: descriptionForSlug(r.slug, r.name),
    memberCount: countByRoleId.get(r.id) ?? 0,
  }));

  return {
    rolesWithPerms,
    tableRows: [systemRow, ...customRows] as Array<typeof systemRow | (typeof customRows)[number]>,
    totalRoles: 1 + customRoles.length,
    canCreate,
    canUpdate,
    canDelete,
  };
}
