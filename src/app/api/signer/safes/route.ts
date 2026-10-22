import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { getCurrentUserOrgs } from "@/lib/auth-server";
import { discoverSignerSafesForWallet } from "@/lib/signer-queue/discover-safes";
import { getLinkedWalletsForUser } from "@/lib/signer-queue/linked-wallets";

/**
 * GET /api/signer/safes
 *
 * Returns multisigs where the user's linked wallet(s) are signers.
 * Discovers safes via Safe Transaction Service (owners API), then enriches
 * with org inventory metadata when the safe is already tracked.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const wallets = await getLinkedWalletsForUser(auth.userId);
  if (wallets.length === 0) {
    return NextResponse.json({ safes: [] });
  }

  const memberships = await getCurrentUserOrgs();
  const orgIds = memberships.map((m) => m.orgId);

  const seen = new Set<string>();
  const results: Array<{
    safeId: string | null;
    safeAddress: string;
    safeName: string | null;
    network: string;
    orgId: string | null;
    orgName: string | null;
    threshold: number;
    ownersCount: number;
    walletAddress: string;
    inInventory: boolean;
  }> = [];

  for (const wallet of wallets) {
    const discovered = await discoverSignerSafesForWallet(wallet.address, orgIds);
    for (const safe of discovered) {
      const key = `${safe.safeAddress.toLowerCase()}:${safe.network}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        ...safe,
        walletAddress: wallet.address,
      });
    }
  }

  return NextResponse.json({ safes: results });
}
