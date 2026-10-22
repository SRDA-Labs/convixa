/**
 * Organizations Repository
 * 
 * Handles all database operations for Organizations and Org Members.
 */

import { eq, and, sql } from "drizzle-orm";
import { db } from "../index";
import { orgs, orgMembers, users, roles } from "../schema";
import { parseCount, firstOrNull } from "../utils/queries";
import type { DbResult } from "../types";

/**
 * Create a new Organization
 */
export async function createOrg(data: {
  name: string;
  slug: string;
}) {
  const [org] = await db
    .insert(orgs)
    .values({
      name: data.name,
      slug: data.slug,
    })
    .returning();

  return firstOrNull([org]);
}

/**
 * Get an Organization by ID
 */
export async function getOrgById(orgId: string): Promise<DbResult<typeof orgs.$inferSelect>> {
  const results = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1);
  return firstOrNull(results);
}

/**
 * Get an Organization by slug
 */
export async function getOrgBySlug(slug: string): Promise<DbResult<typeof orgs.$inferSelect>> {
  const results = await db.select().from(orgs).where(eq(orgs.slug, slug)).limit(1);
  return firstOrNull(results);
}

/**
 * Get all organizations.
 */
export async function getAllOrgs() {
  return await db.select().from(orgs).orderBy(orgs.createdAt);
}

/**
 * Update an Organization
 */
export async function updateOrg(
  orgId: string,
  data: {
    name?: string;
    slug?: string;
  }
) {
  const [updated] = await db
    .update(orgs)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(orgs.id, orgId))
    .returning();

  return firstOrNull([updated]);
}

/**
 * Delete an Organization
 */
export async function deleteOrg(orgId: string): Promise<boolean> {
  try {
    await db.delete(orgs).where(eq(orgs.id, orgId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Add a member to an organization
 */
export async function addOrgMember(data: {
  orgId: string;
  userId: string;
  role: "admin" | "member";
  roleId?: string | null;
}) {
  const [member] = await db
    .insert(orgMembers)
    .values({
      orgId: data.orgId,
      userId: data.userId,
      role: data.role,
      roleId: data.roleId ?? null,
    })
    .returning();

  return firstOrNull([member]);
}

/**
 * Remove a member from an organization
 */
export async function removeOrgMember(orgId: string, userId: string): Promise<boolean> {
  try {
    await db
      .delete(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all members of an organization
 */
export async function getOrgMembers(orgId: string) {
  return await db
    .select({
      id: orgMembers.id,
      userId: orgMembers.userId,
      role: orgMembers.role,
      roleId: orgMembers.roleId,
      email: users.email,
      name: users.name,
      roleName: roles.name,
      createdAt: orgMembers.createdAt,
    })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .leftJoin(roles, eq(orgMembers.roleId, roles.id))
    .where(eq(orgMembers.orgId, orgId))
    .orderBy(orgMembers.createdAt);
}

/**
 * Get user's organization membership
 */
export async function getUserOrgMembership(userId: string, orgId: string) {
  const results = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, orgId)))
    .limit(1);

  return firstOrNull(results);
}

/**
 * Count members in an organization
 */
export async function countOrgMembers(orgId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(orgMembers)
    .where(eq(orgMembers.orgId, orgId));
  return parseCount(result);
}

/**
 * Check if user is an admin of an organization
 */
export async function isOrgAdmin(userId: string, orgId: string): Promise<boolean> {
  const results = await db
    .select({ id: orgMembers.id })
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.userId, userId),
        eq(orgMembers.orgId, orgId),
        eq(orgMembers.role, "admin")
      )
    )
    .limit(1);

  return results.length > 0;
}

/**
 * Check if user is a member of an organization
 */
export async function isOrgMember(userId: string, orgId: string): Promise<boolean> {
  const results = await db
    .select({ id: orgMembers.id })
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, orgId)))
    .limit(1);

  return results.length > 0;
}
