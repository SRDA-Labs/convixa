import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageTeam } from "@/lib/auth-server";
import { getTeamById, removeTeamMember } from "@/lib/db/repositories/teams.repository";
import { requireAuth, requireActiveOrg } from "@/lib/api-helpers";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 min
const RATE_LIMIT_MAX = 10; // member removals per window

const paramsSchema = z.object({
  teamId: z.string().uuid(),
  userId: z.string().uuid(),
});

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ teamId: string; userId: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const orgResult = await requireActiveOrg();
  if (orgResult instanceof NextResponse) return orgResult;

  // Rate limit member removals
  const identifier = getClientIdentifier(_req);
  const { ok: withinLimit } = checkRateLimit(identifier, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX);
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 }
    );
  }

  const parseResult = paramsSchema.safeParse(await context.params);
  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid team or user id" }, { status: 400 });
  }
  const { teamId, userId } = parseResult.data;

  const team = await getTeamById(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  if (!(await canManageTeam(teamId))) {
    return NextResponse.json({ error: "Not allowed to remove members from this team" }, { status: 403 });
  }

  const ok = await removeTeamMember(teamId, userId);
  if (!ok) {
    return NextResponse.json({ error: "Failed to remove member from team" }, { status: 500 });
  }

  logAudit({
    orgId: team.orgId,
    userId: null,
    action: "member.remove",
    resourceType: "team_member",
    metadata: { teamId, removedUserId: userId, teamName: team.name },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
