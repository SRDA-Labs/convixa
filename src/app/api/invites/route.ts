import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invites } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getDefaultOrgId, isOrgAdmin, getDefaultTeams, getTeamsUserLeads, getOrgName, getCurrentUser } from "@/lib/auth-server";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth, parseRequestBody, requireActiveOrg } from "@/lib/api-helpers";
import { sendInviteEmail } from "@/lib/email";

const createSchema = z.object({
  email: z.string().email(),
  teamId: z.string().uuid(),
  role: z.enum(["lead", "member"]),
});

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const orgId = await getDefaultOrgId();
  if (!orgId) return NextResponse.json({ invites: [] });

  const admin = await isOrgAdmin(orgId);
  const leadTeams = await getTeamsUserLeads(orgId);
  const leadTeamIds = new Set(leadTeams.map((t) => t.teamId));

  const list = await db
    .select()
    .from(invites)
    .where(eq(invites.orgId, orgId))
    .orderBy(invites.createdAt);

  let filtered = list;
  if (!admin && leadTeamIds.size > 0) {
    filtered = list.filter((i) => i.teamId != null && leadTeamIds.has(i.teamId));
  }

  const pending = filtered.filter((i) => i.status === "pending" && new Date(i.expiresAt) > new Date());
  return NextResponse.json({ invites: pending });
}

export async function POST(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const orgResult = await requireActiveOrg();
  if (orgResult instanceof NextResponse) return orgResult;
  const { orgId } = orgResult;

  const admin = await isOrgAdmin(orgId);
  const userTeams = await getDefaultTeams();
  const canInvite = admin || userTeams.some((t) => t.role === "lead");
  if (!canInvite) return NextResponse.json({ error: "Not allowed to invite" }, { status: 403 });

  const parseResult = await parseRequestBody(req, createSchema);
  if ("error" in parseResult) return parseResult.error;
  const parsed = parseResult.data;

  if (!admin) {
    const inTeam = userTeams.some((t) => t.teamId === parsed.teamId);
    if (!inTeam) return NextResponse.json({ error: "You can only invite to your teams" }, { status: 403 });
  }

  // Cancel existing pending invites for this email+org (duplicate prevention)
  await db
    .update(invites)
    .set({ status: "expired" })
    .where(
      and(
        eq(invites.email, parsed.email.toLowerCase()),
        eq(invites.orgId, orgId),
        eq(invites.status, "pending")
      )
    );

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [inv] = await db
    .insert(invites)
    .values({
      orgId,
      email: parsed.email.toLowerCase(),
      teamId: parsed.teamId,
      role: parsed.role,
      token,
      createdByUserId: userId,
      expiresAt,
      status: "pending",
    })
    .returning();

  if (!inv) return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });

  const baseUrl = (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3001").replace(/\/$/, "");
  const acceptUrl = `${baseUrl}/invite/accept?token=${token}`;

  // Send invite email — fire-and-forget; don't block the response on delivery.
  const [orgName, inviter] = await Promise.all([getOrgName(orgId), getCurrentUser()]);
  sendInviteEmail(parsed.email.toLowerCase(), {
    orgName: orgName ?? "your organization",
    invitedBy: inviter?.name ?? inviter?.email ?? null,
    acceptUrl,
  }).catch((err) => console.error("[invite] Email send failed:", err));

  return NextResponse.json({
    invite: { id: inv.id, email: inv.email, teamId: inv.teamId, role: inv.role, expiresAt: inv.expiresAt },
    acceptUrl,
  });
}
