import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { getWalletLinksByUser } from "@/lib/db/repositories";

/**
 * GET /api/profile/wallets
 *
 * Returns all linked wallet addresses for the current user,
 * including label, primary status, and verification info.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const links = await getWalletLinksByUser(auth.userId);

  const wallets = links.map((link) => ({
    id: link.id,
    wallet_address: link.walletAddress,
    label: link.label,
    is_primary: link.isPrimary,
    verified_at: link.verifiedAt?.toISOString() ?? null,
    verification_method: link.verificationMethod ?? "siwe",
    created_at: link.createdAt.toISOString(),
  }));

  return NextResponse.json({ wallets });
}
