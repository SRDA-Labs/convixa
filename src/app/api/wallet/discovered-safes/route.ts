import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { users, safes } from "@/lib/db/schema";
import { getDefaultTeams } from "@/lib/auth-server";
import { getSignerSafesForAddress } from "@/lib/get-signer-safes";

export type DiscoveredSafeItem = {
  address: string;
  network: string;
  chainId: number;
  chainName?: string;
  threshold: number;
  owners?: string[];
};

/** GET /api/wallet/discovered-safes – safes where user is signer (from linked wallet) and not in inventory. */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const [row] = await db
    .select({ linkedWalletAddress: users.linkedWalletAddress })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const linkedWallet = row?.linkedWalletAddress?.trim() ?? null;
  if (!linkedWallet) {
    return NextResponse.json({ discovered: [], hasLinkedWallet: false });
  }

  const userTeams = await getDefaultTeams();
  const teamIds = userTeams.map((t) => t.teamId);
  const inInventory = new Set<string>();
  if (teamIds.length > 0) {
    const teamSafesList = await db
      .select({ address: safes.address, network: safes.network })
      .from(safes)
      .where(inArray(safes.teamId, teamIds));
    for (const s of teamSafesList) {
      inInventory.add(`${s.address.toLowerCase()}:${s.network}`);
    }
  }

  const signerSafes = await getSignerSafesForAddress(linkedWallet);
  const discovered: DiscoveredSafeItem[] = signerSafes.filter((s) => {
    const key = `${s.address.toLowerCase()}:${s.network}`;
    return !inInventory.has(key);
  });

  return NextResponse.json({
    discovered: discovered.map((s) => ({
      address: s.address,
      network: s.network,
      chainId: s.chainId,
      chainName: s.chainName,
      threshold: s.threshold,
      owners: s.owners,
    })),
    hasLinkedWallet: true,
  });
}
