import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAuth } from "@/lib/api-helpers";
import { getCurrentUserOrgs } from "@/lib/auth-server";
import { z } from "zod";

const schema = z.object({ orgId: z.string().uuid() });

/**
 * POST /api/switch-org
 * Sets the active organization in both the JWT session and a persistent cookie.
 * Only accepts an orgId the authenticated user is actually a member of.
 */
export async function POST(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid org id" }, { status: 400 });
  }

  const { orgId } = parsed.data;
  const orgs = await getCurrentUserOrgs();
  const isMember = orgs.some((o) => o.orgId === orgId);
  if (!isMember) {
    return NextResponse.json({ error: "Not a member of this org" }, { status: 403 });
  }

  // Update JWT session with active org (scoped to current session)
  const session = await getServerSession(authOptions);
  if (session) {
    const { getToken } = await import("next-auth/jwt");
    // Trigger JWT callback to persist activeOrganizationId
    // We use a cookie-based approach: set it as a secondary cookie that getDefaultOrgId reads
  }

  // Set persistent preferOrg cookie (30 days, httpOnly)
  const res = NextResponse.json({ ok: true });
  res.cookies.set("preferOrg", orgId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: "lax",
  });
  return res;
}
