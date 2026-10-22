import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { getWalletLinkById, setPrimaryWallet } from "@/lib/db/repositories";

/**
 * POST /api/profile/wallets/:id/primary
 *
 * Set a wallet as the primary wallet for the user.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  // Verify the link belongs to this user
  const link = await getWalletLinkById(id);
  if (!link || link.userId !== auth.userId) {
    return NextResponse.json({ error: "Wallet link not found" }, { status: 404 });
  }

  const updated = await setPrimaryWallet(id, auth.userId);
  if (!updated) {
    return NextResponse.json(
      { error: "Failed to set primary wallet" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: updated.id,
    wallet_address: updated.walletAddress,
    is_primary: true,
  });
}
