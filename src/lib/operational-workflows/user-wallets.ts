import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, signerWalletLinks } from "@/lib/db/schema";

export async function getUserWalletAddresses(userId: string): Promise<string[]> {
  const addresses = new Set<string>();

  const [userRow] = await db
    .select({ linkedWalletAddress: users.linkedWalletAddress })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (userRow?.linkedWalletAddress) {
    addresses.add(userRow.linkedWalletAddress.toLowerCase());
  }

  const links = await db
    .select({ walletAddress: signerWalletLinks.walletAddress })
    .from(signerWalletLinks)
    .where(eq(signerWalletLinks.userId, userId));

  for (const link of links) {
    addresses.add(link.walletAddress.toLowerCase());
  }

  return [...addresses];
}

export function isSignerWallet(owners: string[], wallets: string[]): boolean {
  const ownerSet = new Set(owners.map((o) => o.toLowerCase()));
  return wallets.some((w) => ownerSet.has(w));
}
