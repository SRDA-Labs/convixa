import { NextResponse } from "next/server";
import { eq, inArray, desc } from "drizzle-orm";
import { requireAuth, requireOrg } from "@/lib/api-helpers";
import { getDefaultTeams, hasPermission } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { safes, safeSnapshots } from "@/lib/db/schema";
import { getOrgRosterSummary } from "@/lib/db/repositories/safe-signer-roster.repository";
import { analyzeSignerOverlap } from "@/lib/signer-overlap/analyze";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const org = await requireOrg();
  if (org instanceof NextResponse) return org;

  if (!(await hasPermission("security:read", org.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const format = new URL(req.url).searchParams.get("format");
  const userTeams = await getDefaultTeams();
  const teamIds = userTeams.map((t) => t.teamId);
  if (teamIds.length === 0) {
    return NextResponse.json({ signers: [] });
  }

  const safeRows = await db
    .select({
      id: safes.id,
      address: safes.address,
      network: safes.network,
      name: safes.name,
      tags: safes.tags,
    })
    .from(safes)
    .where(inArray(safes.teamId, teamIds));

  const rows: Array<{
    safeId: string;
    safeName: string | null;
    safeAddress: string;
    network: string;
    tags: unknown;
    threshold: number | null;
    owners: unknown;
  }> = [];

  for (const s of safeRows) {
    const [snap] = await db
      .select({
        threshold: safeSnapshots.threshold,
        owners: safeSnapshots.owners,
      })
      .from(safeSnapshots)
      .where(eq(safeSnapshots.safeId, s.id))
      .orderBy(desc(safeSnapshots.refreshedAt))
      .limit(1);

    rows.push({
      safeId: s.id,
      safeName: s.name,
      safeAddress: s.address,
      network: s.network,
      tags: s.tags,
      threshold: snap?.threshold ?? null,
      owners: snap?.owners ?? [],
    });
  }

  const signers = analyzeSignerOverlap(rows);

  const rosterRows = await getOrgRosterSummary(org.orgId);
  const verificationByAddress = new Map<
    string,
    { verified: number; total: number }
  >();
  for (const r of rosterRows) {
    const key = r.signerAddress.toLowerCase();
    const entry = verificationByAddress.get(key) ?? { verified: 0, total: 0 };
    entry.total++;
    if (r.verificationStatus === "verified") entry.verified++;
    verificationByAddress.set(key, entry);
  }

  const enriched = signers.map((e) => {
    const v = verificationByAddress.get(e.signerAddress.toLowerCase());
    return {
      ...e,
      verificationTotal: v?.total ?? 0,
      verificationVerified: v?.verified ?? 0,
    };
  });

  if (format === "csv") {
    const lines = [
      "signer_address,safe_count,flags,verified_count,verification_total,safes",
      ...enriched.map((e) =>
        [
          e.signerAddress,
          e.safes.length,
          e.flags.join("|"),
          e.verificationVerified,
          e.verificationTotal,
          e.safes.map((s) => `${s.network}:${s.safeAddress}`).join(";"),
        ].join(",")
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="signer-overlap.csv"',
      },
    });
  }

  return NextResponse.json({ signers: enriched });
}
