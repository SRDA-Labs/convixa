import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, parseRequestBody } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { users, orgMembers, orgs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { updateUser } from "@/lib/db/repositories/users.repository";
import { getDefaultOrgId } from "@/lib/auth-server";

/** GET /api/profile – return full user profile for the settings UI. */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const [row] = await db
    .select({
      name: users.name,
      email: users.email,
      image: users.image,
      timezone: users.timezone,
      linkedWalletAddress: users.linkedWalletAddress,
      preferences: users.preferences,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get role in the default org
  const orgId = await getDefaultOrgId();
  let role: string | null = null;
  let joinedAt: string | null = null;

  if (orgId) {
    const [membership] = await db
      .select({
        role: orgMembers.role,
        joinedAt: orgMembers.createdAt,
      })
      .from(orgMembers)
      .where(
        and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, auth.userId))
      )
      .limit(1);

    if (membership) {
      role = membership.role;
      joinedAt = membership.joinedAt?.toISOString() ?? null;
    }
  }

  return NextResponse.json({
    name: row.name,
    email: row.email,
    image: row.image,
    timezone: row.timezone ?? "UTC",
    linkedWalletAddress: row.linkedWalletAddress ?? null,
    preferences: row.preferences ?? {
      theme: "dark",
      currency: "USD",
      dateFormat: "MM/DD/YYYY",
      compactMode: false,
    },
    role,
    joinedAt,
    createdAt: row.createdAt?.toISOString() ?? null,
  });
}

const VALID_TIMEZONES = Intl.supportedValuesOf("timeZone");

const patchProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).trim().optional(),
  image: z.string().url("Invalid image URL").max(500).nullable().optional(),
  timezone: z
    .string()
    .refine((tz) => VALID_TIMEZONES.includes(tz), "Invalid timezone")
    .optional(),
  preferences: z
    .object({
      theme: z.enum(["light", "dark", "system"]).optional(),
      currency: z.string().min(1).max(10).optional(),
      dateFormat: z.string().min(1).max(20).optional(),
      compactMode: z.boolean().optional(),
    })
    .optional(),
});

/** PATCH /api/profile – update name, avatar image URL, or timezone. */
export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const parseResult = await parseRequestBody(req, patchProfileSchema);
  if ("error" in parseResult) return parseResult.error;
  const { name, image, timezone, preferences } = parseResult.data;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (image !== undefined) updateData.image = image;
  if (timezone !== undefined) updateData.timezone = timezone;
  if (preferences !== undefined) updateData.preferences = preferences;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await updateUser(auth.userId, updateData as Parameters<typeof updateUser>[1]);
  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    name: updated.name,
    image: updated.image,
    timezone: updated.timezone,
    preferences: updated.preferences,
  });
}
