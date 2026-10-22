/**
 * Default org roles — seeded per org as editable starting points.
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { roles } from "@/lib/db/schema";
import type { Permission } from "@/lib/permissions";

export type DefaultRoleDef = {
  name: string;
  slug: string;
  description: string;
  permissions: Permission[];
};

/** Operational signers: inventory + signer queue only — no Security hub admin views. */
export const DEFAULT_SIGNER_ROLE: DefaultRoleDef = {
  name: "Signer",
  slug: "signer",
  description:
    "View assigned Safes and use the Signer Queue. Cannot access Security hub readiness, drills, or org-wide onboarding administration.",
  permissions: ["safes:read", "signer:workflow"],
};

/** Security operators: full Security hub read + manage (templates, drills, playbooks). */
export const DEFAULT_SECURITY_LEAD_ROLE: DefaultRoleDef = {
  name: "Security Lead",
  slug: "security-lead",
  description:
    "Full Security hub access: readiness dashboard, drills, playbooks, onboarding administration, and compliance exports.",
  permissions: [
    "safes:read",
    "signer:workflow",
    "security:read",
    "security:manage",
    "export:inventory",
    "certification:export",
  ],
};

export const DEFAULT_ORG_ROLES: DefaultRoleDef[] = [
  DEFAULT_SIGNER_ROLE,
  DEFAULT_SECURITY_LEAD_ROLE,
];

export async function syncDefaultOrgRoles(orgId: string): Promise<void> {
  for (const def of DEFAULT_ORG_ROLES) {
    const [existing] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.orgId, orgId), eq(roles.slug, def.slug)))
      .limit(1);

    if (!existing) {
      await db.insert(roles).values({
        orgId,
        name: def.name,
        slug: def.slug,
        permissions: def.permissions,
      });
    }
  }
}

export function descriptionForDefaultSlug(slug: string, name: string): string | null {
  const def = DEFAULT_ORG_ROLES.find((r) => r.slug === slug);
  return def?.description ?? null;
}
