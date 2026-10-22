import {
  getDefaultTeams,
  getOrgTeams,
  isOrgAdmin,
  getTeamsUserLeads,
  getCurrentUser,
} from "@/lib/auth-server";
import { db } from "@/lib/db";
import { safes, teamMembers } from "@/lib/db/schema";
import { inArray, sql } from "drizzle-orm";
import { TeamsTable } from "./teams-table";

export async function TeamsTab({ orgId }: { orgId: string }) {
  const admin = await isOrgAdmin(orgId);
  const leadTeams = await getTeamsUserLeads(orgId);
  const canCreateTeam = admin || leadTeams.length > 0;
  const userTeams = await getDefaultTeams();
  const orgTeamsList = admin ? await getOrgTeams(orgId) : null;
  const currentUser = await getCurrentUser();

  const teamsToShow =
    admin && orgTeamsList
      ? orgTeamsList.map((t) => ({ teamId: t.id, teamName: t.name, slug: t.slug }))
      : userTeams.map((t) => ({ teamId: t.teamId, teamName: t.teamName, slug: t.teamSlug ?? "" }));

  const teamIds = teamsToShow.map((t) => t.teamId);

  const safeCountRows =
    teamIds.length === 0
      ? []
      : await db
          .select({ teamId: safes.teamId, count: sql<number>`count(*)::int` })
          .from(safes)
          .where(inArray(safes.teamId, teamIds))
          .groupBy(safes.teamId);

  const memberCountRows =
    teamIds.length === 0
      ? []
      : await db
          .select({ teamId: teamMembers.teamId, count: sql<number>`count(*)::int` })
          .from(teamMembers)
          .where(inArray(teamMembers.teamId, teamIds))
          .groupBy(teamMembers.teamId);

  const safeCountByTeamId = new Map<string, number>();
  for (const row of safeCountRows) safeCountByTeamId.set(row.teamId, row.count);

  const memberCountByTeamId = new Map<string, number>();
  for (const row of memberCountRows) memberCountByTeamId.set(row.teamId, row.count);

  const teams = teamsToShow.map((t) => ({
    id: t.teamId,
    name: t.teamName,
    slug: t.slug,
    memberCount: memberCountByTeamId.get(t.teamId) ?? 0,
    safeCount: safeCountByTeamId.get(t.teamId) ?? 0,
  }));

  const initialTeamsForList = (orgTeamsList ?? []).map((t) => ({ id: t.id, name: t.name, slug: t.slug }));

  return (
    <TeamsTable
      teams={teams}
      canCreate={canCreateTeam}
      initialTeamsForList={initialTeamsForList}
      orgId={orgId}
      currentUser={
        currentUser
          ? { id: currentUser.id, name: currentUser.name ?? null, email: currentUser.email ?? null }
          : null
      }
    />
  );
}
