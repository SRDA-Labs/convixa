import { getAddress } from "viem";
import { eq } from "drizzle-orm";
import { getWalletLinksByUser } from "@/lib/db/repositories";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export interface LinkedWallet {
  address: string;
  label: string | null;
  isPrimary: boolean;
}

/** Resolve all linked wallet addresses for a user (multi-wallet links + legacy column). */
export async function getLinkedWalletsForUser(userId: string): Promise<LinkedWallet[]> {
  const walletLinks = await getWalletLinksByUser(userId);
  const wallets: LinkedWallet[] = [];
  const seen = new Set<string>();

  for (const link of walletLinks) {
    try {
      const address = getAddress(link.walletAddress);
      const key = address.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      wallets.push({
        address,
        label: link.label,
        isPrimary: link.isPrimary ?? false,
      });
    } catch {
      // skip invalid addresses
    }
  }

  const [userRow] = await db
    .select({ linkedWalletAddress: users.linkedWalletAddress })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const legacyAddress = userRow?.linkedWalletAddress;
  if (legacyAddress) {
    try {
      const address = getAddress(legacyAddress);
      const key = address.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        wallets.push({
          address,
          label: null,
          isPrimary: wallets.length === 0,
        });
      }
    } catch {
      // skip invalid legacy address
    }
  }

  return wallets;
}
