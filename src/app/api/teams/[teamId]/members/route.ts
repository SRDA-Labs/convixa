import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { orgMembers, teamMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { canManageTeam } from "@/lib/auth-server";
import { addTeamMember, getTeamById } from "@/lib/db/repositories/teams.repository";
import { requireAuth, parseRequestBody, requireActiveOrg } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

const paramsSchema = z.object({ teamId: z.string().uuid() });
const bodySchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["lead", "member"]),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ teamId: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId: actorUserId } = authResult;

  const orgResult = await requireActiveOrg();
  if (orgResult instanceof NextResponse) return orgResult;

  const paramsResult = paramsSchema.safeParse(await context.params);
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }
  const { teamId } = paramsResult.data;

  const team = await getTeamById(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  if (!(await canManageTeam(teamId))) {
    return NextResponse.json({ error: "Not allowed to add members to this team" }, { status: 403 });
  }

  const parseResult = await parseRequestBody(req, bodySchema);
  if ("error" in parseResult) return parseResult.error;
  const { userId, role } = parseResult.data;

  const [orgMember] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, team.orgId), eq(orgMembers.userId, userId)))
    .limit(1);

  if (!orgMember) {
    return NextResponse.json({ error: "User is not a member of this organization" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "User is already in this team" }, { status: 400 });
  }

  const member = await addTeamMember({ teamId, userId, role });
  if (!member) {
    return NextResponse.json({ error: "Failed to add member to team" }, { status: 500 });
  }

  await logAudit({
    orgId: team.orgId,
    userId: actorUserId,
    action: "member.add",
    resourceType: "team_member",
    resourceId: member.id,
    metadata: { teamId, addedUserId: userId, role, teamName: team.name },
  });

  return NextResponse.json({ ok: true, member: { id: member.id, userId, role } });
}
