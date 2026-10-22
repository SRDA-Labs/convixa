/**
 * Teams Repository
 * 
 * Handles all database operations for Teams and Team Members.
 */

import { eq, and, inArray } from "drizzle-orm";
import { db } from "../index";
import { teams, teamMembers, users } from "../schema";
import { firstOrNull } from "../utils/queries";
import type { DbResult } from "../types";

/**
 * Create a new Team
 */
export async function createTeam(data: {
  orgId: string;
  name: string;
  slug: string;
  teamLeadUserId?: string | null;
}) {
  const [team] = await db
    .insert(teams)
    .values({
      orgId: data.orgId,
      name: data.name,
      slug: data.slug,
      teamLeadUserId: data.teamLeadUserId ?? null,
    })
    .returning();

  return firstOrNull([team]);
}

/**
 * Get a Team by ID
 */
export async function getTeamById(teamId: string): Promise<DbResult<typeof teams.$inferSelect>> {
  const results = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  return firstOrNull(results);
}

/**
 * Get all Teams for an organization
 */
export async function getTeamsByOrg(orgId: string) {
  return await db
    .select()
    .from(teams)
    .where(eq(teams.orgId, orgId))
    .orderBy(teams.createdAt);
}

/**
 * Update a Team
 */
export async function updateTeam(
  teamId: string,
  data: {
    name?: string;
    slug?: string;
    teamLeadUserId?: string | null;
  }
) {
  const [updated] = await db
    .update(teams)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId))
    .returning();

  return firstOrNull([updated]);
}

/**
 * Delete a Team
 */
export async function deleteTeam(teamId: string): Promise<boolean> {
  try {
    await db.delete(teams).where(eq(teams.id, teamId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Add a user to a team
 */
export async function addTeamMember(data: {
  teamId: string;
  userId: string;
  role: string;
}) {
  const [member] = await db
    .insert(teamMembers)
    .values({
      teamId: data.teamId,
      userId: data.userId,
      role: data.role,
    })
    .returning();

  return firstOrNull([member]);
}

/**
 * Remove a user from a team
 */
export async function removeTeamMember(teamId: string, userId: string): Promise<boolean> {
  try {
    await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all members of a team
 */
export async function getTeamMembers(teamId: string) {
  return await db
    .select({
      id: teamMembers.id,
      userId: teamMembers.userId,
      role: teamMembers.role,
      email: users.email,
      name: users.name,
      createdAt: teamMembers.createdAt,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(teamMembers.createdAt);
}

/**
 * Get all teams for a user
 */
export async function getUserTeams(userId: string) {
  return await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      teamSlug: teams.slug,
      role: teamMembers.role,
      orgId: teams.orgId,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, userId))
    .orderBy(teams.name);
}

/**
 * Check if user is a member of a team
 */
export async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
  const results = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);

  return results.length > 0;
}

/**
 * Check if user is a team lead
 */
export async function isTeamLead(teamId: string, userId: string): Promise<boolean> {
  const results = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId),
        eq(teamMembers.role, "lead")
      )
    )
    .limit(1);

  return results.length > 0;
}
