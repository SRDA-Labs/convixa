import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { getAddress } from "viem";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { safes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getDefaultOrgId, getDefaultTeams, hasPermission, getCurrentUser, getOrgStatus } from "@/lib/auth-server";
import type { Permission } from "@/lib/permissions";

/**
 * Auth helper that validates session and returns authenticated user.
 * Returns NextResponse with 401 if unauthorized.
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { user, userId: user.id };
}

/**
 * Org validation helper that validates user has an organization.
 * Returns NextResponse with 403 if no org found.
 */
export async function requireOrg() {
  const orgId = await getDefaultOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "Not in an org" }, { status: 403 });
  }
  return { orgId };
}

/**
 * Require an active org — validates org exists and is not soft-deleted.
 * Use this instead of requireOrg() for mutation endpoints.
 */
export async function requireActiveOrg() {
  const orgResult = await requireOrg();
  if (orgResult instanceof NextResponse) return orgResult;
  const { orgId } = orgResult;

  const status = await getOrgStatus(orgId);
  if (status.deletedAt) {
    return NextResponse.json(
      { error: "Organization has been deleted." },
      { status: 410 }
    );
  }

  return { orgId, status };
}

/**
 * Permission check helper that validates user has required permission.
 * Returns NextResponse with 403 if permission denied, null if allowed.
 */
export async function requirePermission(permission: Permission, orgId?: string): Promise<NextResponse | null> {
  const ok = await hasPermission(permission, orgId);
  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * Safe access validation helper that checks if user has access to the safe.
 * Validates:
 * - Safe exists
 * - User's team has access to the safe
 * - Safe address is valid
 * Returns NextResponse with error or safe data with valid address.
 */
export async function validateSafeAccess(safeId: string) {
  const userTeams = await getDefaultTeams();
  const teamIds = userTeams.map((t) => t.teamId);

  const [safe] = await db
    .select()
    .from(safes)
    .where(eq(safes.id, safeId))
    .limit(1);

  if (!safe || !teamIds.includes(safe.teamId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let safeAddress: string;
  try {
    safeAddress = getAddress(safe.address);
  } catch {
    return NextResponse.json({ error: "Invalid Safe address" }, { status: 400 });
  }

  return { safe, safeAddress };
}

/**
 * Request body parser with Zod validation.
 * Returns parsed data or NextResponse with validation error.
 */
export async function parseRequestBody<T>(req: Request, schema: z.ZodSchema<T>) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  
  if (!parsed.success) {
    return {
      error: NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      ),
    };
  }
  
  return { data: parsed.data };
}

/**
 * Safe JSON parse with default fallback.
 * Returns parsed JSON or default value if parsing fails.
 * With PostgreSQL native JSON columns, Drizzle returns objects directly,
 * so this function now handles both strings and objects.
 */
export function safeJsonParse<T>(json: string | T | null | undefined, defaultValue: T): T {
  if (!json) return defaultValue;
  // If it's already an object/array (from PostgreSQL JSON column), return it
  if (typeof json !== 'string') return json as T;
  // Otherwise parse the JSON string (for backward compatibility)
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Combines requireAuth and requireOrg checks.
 * Returns user and orgId or NextResponse with error.
 */
export async function requireAuthAndOrg() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const orgResult = await requireOrg();
  if (orgResult instanceof NextResponse) {
    return orgResult;
  }

  return { ...authResult, ...orgResult };
}

/**
 * Combines requireAuth, requireOrg, and requirePermission checks.
 * Returns user, userId, and orgId or NextResponse with error.
 */
export async function requireAuthOrgPermission(permission: Permission) {
  const result = await requireAuthAndOrg();
  if (result instanceof NextResponse) {
    return result;
  }

  const permResult = await requirePermission(permission, result.orgId);
  if (permResult) {
    return permResult;
  }

  return result;
}

/** Auth + org + security hub read access. */
export async function requireAuthOrgSecurityRead() {
  return requireAuthOrgPermission("security:read");
}

/** Auth + org + security hub manage access. */
export async function requireAuthOrgSecurityManage() {
  return requireAuthOrgPermission("security:manage");
}

/** Auth + org + signer queue workflow access. */
export async function requireAuthSignerWorkflow() {
  return requireAuthOrgPermission("signer:workflow");
}
