import { NextResponse } from "next/server";
import { getDefaultTeams, getDefaultOrgId, getOrgTeams, isOrgAdmin, getTeamsUserLeads } from "@/lib/auth-server";
import { z } from "zod";
import { requireAuth, parseRequestBody, requireActiveOrg } from "@/lib/api-helpers";
import { createTeam } from "@/lib/db/repositories";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const orgId = await getDefaultOrgId();
  if (!orgId) return NextResponse.json({ teams: [] });

  const admin = await isOrgAdmin(orgId);
  const teamsList = admin
    ? await getOrgTeams(orgId)
    : await getDefaultTeams();

  const normalized = Array.isArray(teamsList)
    ? teamsList.map((t: { id?: string; teamId?: string; teamName?: string; name?: string }) => ({
        teamId: t.id ?? t.teamId,
        teamName: t.name ?? t.teamName,
      }))
    : [];

  return NextResponse.json({ teams: normalized });
}

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const orgResult = await requireActiveOrg();
  if (orgResult instanceof NextResponse) return orgResult;
  const { orgId } = orgResult;

  const admin = await isOrgAdmin(orgId);
  const leadTeams = await getTeamsUserLeads(orgId);
  const canCreate = admin || leadTeams.length > 0;
  if (!canCreate) return NextResponse.json({ error: "Only org admins and team leads can create teams" }, { status: 403 });

  const parseResult = await parseRequestBody(req, createSchema);
  if ("error" in parseResult) return parseResult.error;
  const parsed = parseResult.data;

  const slug =
    (parsed.slug?.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") ??
      parsed.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")) ||
    `team-${Date.now().toString(36)}`;

  // Use repository to create team
  const team = await createTeam({
    orgId,
    name: parsed.name,
    slug,
  });

  if (!team) return NextResponse.json({ error: "Failed to create team" }, { status: 500 });

  logAudit({
    orgId,
    userId: authResult.userId,
    action: "team.create",
    resourceType: "team",
    resourceId: team.id,
    metadata: { teamName: team.name, teamSlug: team.slug },
  }).catch(() => {});

  return NextResponse.json({ team: { id: team.id, name: team.name, slug: team.slug } });
}
