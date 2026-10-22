import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { invites, orgMembers, teamMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

export default async function InviteAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const { token } = await searchParams;

  if (!token) {
    redirect("/dashboard?error=missing-token");
  }

  const [inv] = await db.select().from(invites).where(eq(invites.token, token)).limit(1);

  if (!inv || inv.status !== "pending") {
    redirect("/dashboard?error=invalid-invite");
  }

  if (new Date(inv.expiresAt) <= new Date()) {
    await db.update(invites).set({ status: "expired" }).where(eq(invites.id, inv.id));
    redirect("/dashboard?error=invite-expired");
  }

  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/invite/accept?token=${token}`)}&message=Sign in to accept. If you don't have an account, ask your org admin to add you.`);
  }

  const sessionEmail = (session.user as { email?: string | null }).email?.toLowerCase() ?? "";
  if (sessionEmail !== inv.email.toLowerCase()) {
    // Logged in as the wrong account — force sign-in with the invited address.
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/invite/accept?token=${token}`)}&message=${encodeURIComponent(`This invite was sent to ${inv.email}. Please sign in with that account to accept.`)}`
    );
  }

  const userId = (session.user as { id: string }).id;

  const [existingOrg] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, inv.orgId), eq(orgMembers.userId, userId)))
    .limit(1);

  if (!existingOrg) {
    await db.insert(orgMembers).values({
      orgId: inv.orgId,
      userId,
      role: "member",
    });
  }

  if (inv.teamId) {
    const [existingTeam] = await db
      .select()
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
      // Upgrade/change role if a newer invite specifies a different one (e.g. member → lead).
      await db
        .update(teamMembers)
        .set({ role: inv.role })
        .where(and(eq(teamMembers.teamId, inv.teamId), eq(teamMembers.userId, userId)));
    }
  }

  await db.update(invites).set({ status: "accepted" }).where(eq(invites.id, inv.id));

  await logAudit({
    orgId: inv.orgId,
    userId,
    action: "invite.accepted",
    resourceType: "invite",
    resourceId: inv.id,
    metadata: { inviteId: inv.id, orgId: inv.orgId, teamId: inv.teamId, userId, email: inv.email },
  });

  // Pass orgId so the dashboard layout can activate the correct org for the session.
  redirect(`/dashboard?invite=accepted&orgId=${inv.orgId}`);
}
