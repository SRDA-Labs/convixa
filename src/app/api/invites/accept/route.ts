import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { db } from "@/lib/db";
import { invites, orgMembers, teamMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({
  token: z.string().min(1, "Token required"),
});

/**
 * POST /api/invites/accept
 * Accept an invite by token. Requires authenticated session.
 * Returns JSON so it can be called from any client (web, mobile, CLI).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required to accept an invite" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }
  const { token } = parsed.data;

  const [inv] = await db
    .select()
    .from(invites)
    .where(eq(invites.token, token))
    .limit(1);

  if (!inv || inv.status !== "pending") {
    return NextResponse.json({ error: "Invalid or already accepted invite" }, { status: 404 });
  }
  if (new Date(inv.expiresAt) <= new Date()) {
    await db.update(invites).set({ status: "expired" }).where(eq(invites.id, inv.id));
    return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
  }

  const sessionEmail = (session.user as { email?: string | null }).email?.toLowerCase() ?? "";
  if (sessionEmail !== inv.email.toLowerCase()) {
    return NextResponse.json(
      { error: `This invite was sent to ${inv.email}. Please sign in with that account.` },
      { status: 403 }
    );
  }

  const userId = (session.user as { id: string }).id;

  // Add to org if not already a member
  const [existingOrg] = await db
    .select({ id: orgMembers.id })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, inv.orgId), eq(orgMembers.userId, userId)))
    .limit(1);

  let addedToOrg = false;
  if (!existingOrg) {
    await db.insert(orgMembers).values({
      orgId: inv.orgId,
      userId,
      role: "member",
    });
    addedToOrg = true;
  }

  // Add to team if needed
  if (inv.teamId) {
    const [existingTeam] = await db
      .select({ id: teamMembers.id, role: teamMembers.role })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, inv.teamId), eq(teamMembers.userId, userId)))
      .limit(1);

    if (!existingTeam) {
      await db.insert(teamMembers).values({
        teamId: inv.teamId,
        userId,
        role: inv.role,
      });
    } else if (existingTeam.role !== inv.role) {
      await db
        .update(teamMembers)
        .set({ role: inv.role })
        .where(and(eq(teamMembers.teamId, inv.teamId), eq(teamMembers.userId, userId)));
    }
  }

  // Mark invite as accepted
  await db.update(invites).set({ status: "accepted" }).where(eq(invites.id, inv.id));

  logAudit({
    orgId: inv.orgId,
    userId,
    action: "invite.accepted",
    resourceType: "invite",
    resourceId: inv.id,
    metadata: { inviteId: inv.id, orgId: inv.orgId, teamId: inv.teamId, email: inv.email },
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    orgId: inv.orgId,
    message: addedToOrg ? "You have joined the organization." : "Invite accepted.",
  });
}
