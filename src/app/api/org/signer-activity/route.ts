import { NextResponse } from "next/server";
import { requireAuth, requireOrg } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import { getOrgEoaActivity } from "@/lib/db/repositories/safe-signer-roster.repository";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const org = await requireOrg();
  if (org instanceof NextResponse) return org;

  if (!(await hasPermission("security:read", org.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await getOrgEoaActivity(org.orgId);

  return NextResponse.json({
    activity: rows.map((r) => ({
      signerAddress: r.signerAddress,
      network: r.network,
      activityCount7d: r.activityCount7d,
      lastOutgoingTxAt: r.lastOutgoingTxAt?.toISOString() ?? null,
      lastOutgoingTxHash: r.lastOutgoingTxHash,
      lastCheckedAt: r.lastCheckedAt?.toISOString() ?? null,
    })),
  });
}
