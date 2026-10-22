import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { orgMembers, signerWalletLinks, users } from "@/lib/db/schema";

export type SignerIdentitySuggestion = {
  signerAddress: string;
  orgMemberUserId: string | null;
  userName: string | null;
  userEmail: string | null;
  matchSource: "signer_wallet_links" | "linked_wallet_address" | null;
};

/**
 * Suggest org member matches for roster addresses. Never auto-assigns — admin confirms.
 */
export async function suggestOrgMemberMatches(
  orgId: string,
  signerAddresses: string[]
): Promise<SignerIdentitySuggestion[]> {
  if (signerAddresses.length === 0) return [];

  const normalized = signerAddresses.map((a) => a.toLowerCase());

  const members = await db
    .select({
      userId: orgMembers.userId,
      name: users.name,
      email: users.email,
      linkedWalletAddress: users.linkedWalletAddress,
    })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(eq(orgMembers.orgId, orgId));

  const memberIds = members.map((m) => m.userId);
  const walletLinks =
    memberIds.length > 0
      ? await db
          .select({
            userId: signerWalletLinks.userId,
            walletAddress: signerWalletLinks.walletAddress,
          })
          .from(signerWalletLinks)
          .where(inArray(signerWalletLinks.userId, memberIds))
      : [];

  const linksByUser = new Map<string, string[]>();
  for (const link of walletLinks) {
    const list = linksByUser.get(link.userId) ?? [];
    list.push(link.walletAddress.toLowerCase());
    linksByUser.set(link.userId, list);
  }

  return normalized.map((addr, i) => {
    const originalAddr = signerAddresses[i] ?? addr;

    for (const member of members) {
      const linked = member.linkedWalletAddress?.toLowerCase();
      if (linked === addr) {
        return {
          signerAddress: originalAddr,
          orgMemberUserId: member.userId,
          userName: member.name,
          userEmail: member.email,
          matchSource: "linked_wallet_address" as const,
        };
      }

      const userLinks = linksByUser.get(member.userId) ?? [];
      if (userLinks.includes(addr)) {
        return {
          signerAddress: originalAddr,
          orgMemberUserId: member.userId,
          userName: member.name,
          userEmail: member.email,
          matchSource: "signer_wallet_links" as const,
        };
      }
    }

    return {
      signerAddress: originalAddr,
      orgMemberUserId: null,
      userName: null,
      userEmail: null,
      matchSource: null,
    };
  });
}
