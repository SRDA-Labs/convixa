import { NextResponse } from "next/server";
import { requireAuth, validateSafeAccess } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import { getRosterById } from "@/lib/db/repositories/safe-signer-roster.repository";
import { issueAffiliationChallenge, getOrgName } from "@/lib/signer-roster/verify-affiliation";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; rosterId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id, rosterId } = await params;
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(rosterId).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const access = await validateSafeAccess(id);
  if (access instanceof NextResponse) return access;
  const { safe, safeAddress } = access;

  const row = await getRosterById(rosterId);
  if (!row || row.safeId !== id || row.removedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const orgName = await getOrgName(safe.orgId);
  const challenge = await issueAffiliationChallenge(row, {
    safeAddress,
    network: safe.network,
    orgName,
    safePurpose: safe.purpose ?? "",
  });

  return NextResponse.json({
    message: challenge.message,
    requestId: challenge.requestId,
    expiresAt: challenge.expiresAt.toISOString(),
    signerAddress: row.signerAddress,
  });
}
