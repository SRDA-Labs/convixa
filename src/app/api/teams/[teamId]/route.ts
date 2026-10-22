import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageTeam, hasPermission } from "@/lib/auth-server";
import { getTeamById, updateTeam } from "@/lib/db/repositories/teams.repository";
import { requireAuth, parseRequestBody } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

const paramsSchema = z.object({ teamId: z.string().uuid() });

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ teamId: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const paramsResult = paramsSchema.safeParse(await context.params);
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }
  const { teamId } = paramsResult.data;

  const team = await getTeamById(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const canManage = (await canManageTeam(teamId)) || (await hasPermission("teams:update", team.orgId));
  if (!canManage) {
    return NextResponse.json({ error: "Not allowed to update this team" }, { status: 403 });
  }

  const parseResult = await parseRequestBody(req, patchSchema);
  if ("error" in parseResult) return parseResult.error;
  const body = parseResult.data;

  if (!body.name && !body.slug) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const slug = body.slug
    ? body.slug.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
    : undefined;

  const updated = await updateTeam(teamId, {
    name: body.name?.trim(),
    slug: slug || undefined,
  });

  if (!updated) {
    return NextResponse.json({ error: "Failed to update team" }, { status: 500 });
  }

  await logAudit({
    orgId: team.orgId,
    userId: authResult.userId,
    action: "team.update",
    resourceType: "team",
    resourceId: teamId,
    metadata: { teamName: updated.name, teamSlug: updated.slug },
  });

  return NextResponse.json({ team: { id: updated.id, name: updated.name, slug: updated.slug } });
}
