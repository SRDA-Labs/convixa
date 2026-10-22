import { NextResponse } from "next/server";
import { requireAuthAndOrg } from "@/lib/api-helpers";
import { getDefaultTeams } from "@/lib/auth-server";
import {
  listTxThreadsByTeams,
  listInvitedThreadsForUser,
} from "@/lib/db/repositories/tx-proposals.repository";

export async function GET(req: Request) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const status = url.searchParams.get("status")?.trim() || undefined;
  const teamId = url.searchParams.get("teamId")?.trim() || undefined;

  const userTeams = await getDefaultTeams();
  const teamIds = userTeams.map((t) => t.teamId);

  const [teamThreads, invitedThreads] = await Promise.all([
    listTxThreadsByTeams(auth.orgId, teamIds, { status, teamId }),
    listInvitedThreadsForUser(auth.userId, auth.orgId),
  ]);

  const seen = new Set<string>();
  const threads = [];
  for (const row of [...teamThreads, ...invitedThreads]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    threads.push(row);
  }

  threads.sort((a, b) => {
    const aT = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
    const bT = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
    return bT - aT;
  });

  return NextResponse.json({ threads });
}
