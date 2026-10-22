import { NextResponse } from "next/server";
import { requireAuthAndOrg } from "@/lib/api-helpers";
import { getDefaultTeams, hasPermission } from "@/lib/auth-server";
import { getReviewsByOrg } from "@/lib/db/repositories/operational-workflows.repository";
import { getOrgPendingTxMatrix } from "@/lib/operational-workflows/pending-tx-matrix";

export async function GET() {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:read", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const teams = await getDefaultTeams();
  const teamIds = teams.map((t) => t.teamId);

  const [reviews, pendingTxs] = await Promise.all([
    getReviewsByOrg(auth.orgId, teamIds),
    getOrgPendingTxMatrix(auth.orgId),
  ]);

  return NextResponse.json({ reviews, pendingTxs });
}
