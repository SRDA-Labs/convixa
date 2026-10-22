import crypto from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { orgMembers, orgs, teamMembers, teams } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";
import { syncDefaultOrgRoles } from "@/lib/default-roles";

export const DEFAULT_ORG_NAME = "My Organization";

export function orgSlugFromName(name: string): string {
  const baseSlug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "org";
  return `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Create a default org + owner membership + default team when the user has none. */
export async function ensureDefaultOrgForUser(
  userId: string,
  options?: { name?: string; audit?: boolean }
): Promise<string> {
  const [existing] = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .innerJoin(orgs, eq(orgMembers.orgId, orgs.id))
    .where(and(eq(orgMembers.userId, userId), isNull(orgs.deletedAt)))
    .limit(1);

  if (existing) return existing.orgId;

  const orgName = options?.name?.trim() || DEFAULT_ORG_NAME;
  const slug = orgSlugFromName(orgName);

  const [newOrg] = await db.insert(orgs).values({ name: orgName, slug }).returning();
  if (!newOrg) {
    throw new Error("Failed to create organization");
  }

  await db.insert(orgMembers).values({
    orgId: newOrg.id,
    userId,
    role: "owner",
  });

  const [newTeam] = await db
    .insert(teams)
    .values({
      orgId: newOrg.id,
      name: "Default",
      slug: "default",
      teamLeadUserId: userId,
    })
    .returning();

  if (newTeam) {
    await db.insert(teamMembers).values({
      teamId: newTeam.id,
      userId,
      role: "lead",
    });
  }

  await syncDefaultOrgRoles(newOrg.id);

  if (options?.audit !== false) {
    logAudit({
      orgId: newOrg.id,
      userId,
      action: "org.created",
      resourceType: "org",
      resourceId: newOrg.id,
      metadata: { orgName: newOrg.name, bootstrap: true },
    }).catch(() => {});
  }

  return newOrg.id;
}
