import { NextResponse } from "next/server";
import { requireAuth, requireOrg } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import { getOrgRosterSummary } from "@/lib/db/repositories/safe-signer-roster.repository";

export async function GET(_req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const org = await requireOrg();
  if (org instanceof NextResponse) return org;

  if (!(await hasPermission("security:read", org.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await getOrgRosterSummary(org.orgId);
  const treasuryProtocol = rows.filter(
    (r) => r.classification === "treasury" || r.classification === "protocol_critical"
  );
  const all = rows;
  const verified = all.filter((r) => r.verificationStatus === "verified");
  const cryptoVerified = verified.filter((r) => r.verificationMethod === "siwe_affiliation");
  const attested = verified.filter((r) => r.verificationMethod === "admin_attested");
  const unverified = all.filter(
    (r) => r.verificationStatus === "unverified" || r.verificationStatus === "pending"
  );

  const bySafe = new Map<
    string,
    { safeId: string; safeName: string | null; total: number; verified: number; classification: string | null }
  >();

  for (const r of rows) {
    const entry = bySafe.get(r.safeId) ?? {
      safeId: r.safeId,
      safeName: r.safeName,
      total: 0,
      verified: 0,
      classification: r.classification,
    };
    entry.total++;
    if (r.verificationStatus === "verified") entry.verified++;
    bySafe.set(r.safeId, entry);
  }

  return NextResponse.json({
    summary: {
      totalSigners: all.length,
      verifiedCount: verified.length,
      cryptoVerifiedCount: cryptoVerified.length,
      attestedCount: attested.length,
      unverifiedCount: unverified.length,
      verificationPct: all.length > 0 ? Math.round((verified.length / all.length) * 100) : 0,
      treasuryProtocolSigners: treasuryProtocol.length,
      treasuryProtocolVerified: treasuryProtocol.filter((r) => r.verificationStatus === "verified")
        .length,
    },
    bySafe: Array.from(bySafe.values()).sort((a, b) => a.verified / a.total - b.verified / b.total),
    unverified: unverified.map((r) => ({
      rosterId: r.id,
      safeId: r.safeId,
      safeName: r.safeName,
      signerAddress: r.signerAddress,
      verificationStatus: r.verificationStatus,
    })),
  });
}
