import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { orgMembers, orgs, teamMembers, teams, roles, users } from "@/lib/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import {
  PERMISSIONS,
  BASELINE_MEMBER_PERMISSIONS,
  type Permission,
} from "@/lib/permissions";

/** Whether the current user is org admin for the given org (or default org). */
export async function isOrgAdmin(orgId?: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const list = await getCurrentUserOrgs();
  const targetOrgId = orgId ?? (await getDefaultOrgId()) ?? list[0]?.orgId;
  if (!targetOrgId) return false;
  return list.some((m) => m.orgId === targetOrgId && (m.role === "admin" || m.role === "owner"));
}

/** All teams in the org (for admin); otherwise same as getCurrentUserTeams. */
export async function getOrgTeams(orgId: string) {
  const list = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      teamLeadUserId: teams.teamLeadUserId,
      orgId: teams.orgId,
      createdAt: teams.createdAt,
    })
    .from(teams)
    .where(eq(teams.orgId, orgId))
    .orderBy(teams.createdAt);

  return list;
}

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return null;

  // Check if all sessions were revoked for this user
  const [userRow] = await db
    .select({ sessionsRevokedAt: users.sessionsRevokedAt })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (userRow?.sessionsRevokedAt) {
    const revokedAt = new Date(userRow.sessionsRevokedAt);
    const sessionIat = (session as unknown as { iat?: number })?.iat;
    if (sessionIat && sessionIat * 1000 < revokedAt.getTime()) {
      return null; // Session was issued before revocation — reject
    }
  }

  return { ...session!.user, id };
}

export async function getCurrentUserOrgs() {
  const user = await getCurrentUser();
  if (!user) return [];

  const memberships = await db
    .select({
      orgId: orgMembers.orgId,
      role: orgMembers.role,
      orgName: orgs.name,
      orgSlug: orgs.slug,
      joinedAt: orgMembers.createdAt,
    })
    .from(orgMembers)
    .innerJoin(orgs, eq(orgMembers.orgId, orgs.id))
    .where(and(eq(orgMembers.userId, user.id), isNull(orgs.deletedAt)))
    .orderBy(
      sql`CASE WHEN ${orgMembers.role} = 'owner' THEN 0 WHEN ${orgMembers.role} = 'admin' THEN 1 ELSE 2 END`,
      sql`${orgMembers.createdAt} DESC`
    );

  return memberships;
}

export async function getCurrentUserTeams(orgId?: string) {
  const user = await getCurrentUser();
  if (!user) return [];

  const conditions = [eq(teamMembers.userId, user.id)];
  if (orgId) conditions.push(eq(teams.orgId, orgId));

  const list = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      teamSlug: teams.slug,
      role: teamMembers.role,
      orgId: teams.orgId,
      orgName: orgs.name,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .innerJoin(orgs, eq(teams.orgId, orgs.id))
    .where(and(...conditions));

  return list;
}

/** Whether the current user is team lead for the given team (or any team in default org if teamId omitted). */
export async function isTeamLead(teamId?: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (teamId) {
    const [row] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id), eq(teamMembers.role, "lead")))
      .limit(1);
    return Boolean(row);
  }
  const orgId = await getDefaultOrgId();
  if (!orgId) return false;
  const leads = await getTeamsUserLeads(orgId);
  return leads.length > 0;
}

/** Whether the current user can manage the given team (org admin for that team's org or team lead of that team). */
export async function canManageTeam(teamId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const [teamRow] = await db.select({ orgId: teams.orgId }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!teamRow) return false;
  if (await isOrgAdmin(teamRow.orgId)) return true;
  return isTeamLead(teamId);
}

/** Teams in the given org (or default org) where the current user is team lead. */
export async function getTeamsUserLeads(orgId?: string): Promise<{ teamId: string; teamName: string }[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const targetOrgId = orgId ?? (await getDefaultOrgId());
  if (!targetOrgId) return [];
  const list = await db
    .select({ teamId: teams.id, teamName: teams.name })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(and(eq(teamMembers.userId, user.id), eq(teams.orgId, targetOrgId), eq(teamMembers.role, "lead")));
  return list;
}

/**
 * First org the user belongs to.
 * Priority:
 * 1) preferOrgId hint
 * 2) Session JWT activeOrganizationId
 * 3) preferOrg cookie
 * 4) First org membership
 */
export async function getDefaultOrgId(preferOrgId?: string | null): Promise<string | null> {
  // 1. Explicit hint from request
  if (preferOrgId) {
    const orgsList = await getCurrentUserOrgs();
    const match = orgsList.find((o) => o.orgId === preferOrgId);
    if (match) return match.orgId;
  }

  // 2. Session JWT activeOrganizationId (set via switch-org)
  const session = await getSession();
  const sessionOrgId = (session?.user as { activeOrganizationId?: string | null } | undefined)?.activeOrganizationId;
  if (sessionOrgId) {
    const orgsList = await getCurrentUserOrgs();
    const match = orgsList.find((o) => o.orgId === sessionOrgId);
    if (match) return match.orgId;
  }

  // 3. preferOrg cookie (set by switch-org or invite acceptance)
  const { cookies: cookiesFn } = await import("next/headers");
  const cookieStore = await cookiesFn();
  const preferOrgCookie = cookieStore.get("preferOrg");
  if (preferOrgCookie?.value) {
    const orgsList = await getCurrentUserOrgs();
    const match = orgsList.find((o) => o.orgId === preferOrgCookie.value);
    if (match) return match.orgId;
  }

  // 4. First org membership
  const orgsList = await getCurrentUserOrgs();
  if (orgsList.length > 0) return orgsList[0].orgId;

  return null;
}

/** Org name by id. */
export async function getOrgName(orgId: string): Promise<string | null> {
  const [row] = await db.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
  return row?.name ?? null;
}

/** Org slug by id. */
export async function getOrgSlug(orgId: string): Promise<string | null> {
  const [row] = await db.select({ slug: orgs.slug }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
  return row?.slug ?? null;
}

/** Org status for client. */
export async function getOrgStatus(orgId: string): Promise<{
  deletedAt: string | null;
}> {
  const [row] = await db
    .select({ deletedAt: orgs.deletedAt })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);

  return {
    deletedAt: row?.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

/** Teams for the default org that the user can see. When the user is org admin, returns all teams. */
export async function getDefaultTeams() {
  const orgId = await getDefaultOrgId();
  if (!orgId) return [];
  const userOrgs = await getCurrentUserOrgs();
  const isOrgAdminUser = userOrgs.some((o) => o.orgId === orgId && (o.role === "admin" || o.role === "owner"));
  if (isOrgAdminUser) {
    const orgTeamsList = await getOrgTeams(orgId);
    const orgName = await getOrgName(orgId);
    return orgTeamsList.map((t) => ({
      teamId: t.id,
      teamName: t.name,
      teamSlug: t.slug,
      role: "admin" as const,
      orgId: t.orgId,
      orgName: orgName ?? undefined,
    }));
  }
  return getCurrentUserTeams(orgId);
}

/** Effective permission set for the current user in an org. */
export async function getUserPermissions(orgId?: string): Promise<Permission[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const targetOrgId = orgId ?? (await getDefaultOrgId());
  if (!targetOrgId) return [];

  const [m] = await db
    .select({ role: orgMembers.role, roleId: orgMembers.roleId })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, targetOrgId), eq(orgMembers.userId, user.id)))
    .limit(1);

  if (!m) return [];
  if (m.role === "admin" || m.role === "owner") return [...PERMISSIONS];
  if (m.role === "member" && !m.roleId) return [...BASELINE_MEMBER_PERMISSIONS];
  if (!m.roleId) return [];

  const [r] = await db
    .select({ permissions: roles.permissions })
    .from(roles)
    .where(eq(roles.id, m.roleId))
    .limit(1);
  if (!r?.permissions) return [];

  const raw = Array.isArray(r.permissions) ? (r.permissions as string[]) : [];
  return raw.filter((p): p is Permission =>
    (PERMISSIONS as readonly string[]).includes(p)
  );
}

/** Whether the current user has the given permission in the org. Admin/owner has all. */
export async function hasPermission(permission: Permission, orgId?: string): Promise<boolean> {
  const perms = await getUserPermissions(orgId);
  return perms.includes(permission);
}

/**
 * Remove an org member, with last-owner protection.
 * Throws if the member is the last owner.
 */
export async function removeOrgMember(memberId: string, orgId: string): Promise<void> {
  const [member] = await db
    .select({ id: orgMembers.id, role: orgMembers.role, userId: orgMembers.userId })
    .from(orgMembers)
    .where(and(eq(orgMembers.id, memberId), eq(orgMembers.orgId, orgId)))
    .limit(1);

  if (!member) throw new Error("Member not found");

  // Prevent removing the last owner
  if (member.role === "owner") {
    const [count] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, "owner")));
    if ((count?.count ?? 1) <= 1) {
      throw new Error("Cannot remove the last owner. Transfer ownership first.");
    }
  }

  await db.delete(orgMembers).where(eq(orgMembers.id, memberId));
}

/**
 * Update a member's role, with last-owner demotion protection.
 * Throws if demoting the last owner.
 */
export async function updateMemberRole(
  memberId: string,
  orgId: string,
  newRole: string
): Promise<void> {
  const [member] = await db
    .select({ id: orgMembers.id, role: orgMembers.role })
    .from(orgMembers)
    .where(and(eq(orgMembers.id, memberId), eq(orgMembers.orgId, orgId)))
    .limit(1);

  if (!member) throw new Error("Member not found");

  // Prevent demoting the last owner to non-owner role
  if (member.role === "owner" && newRole !== "owner") {
    const [count] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, "owner")));
    if ((count?.count ?? 1) <= 1) {
      throw new Error("Cannot demote the last owner. Transfer ownership first.");
    }
  }

  await db
    .update(orgMembers)
    .set({ role: newRole, updatedAt: new Date() })
    .where(eq(orgMembers.id, memberId));
}
