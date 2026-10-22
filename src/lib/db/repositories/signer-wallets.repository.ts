import { eq, and, desc } from "drizzle-orm";
import { db } from "../index";
import { signerWalletLinks, signerQueueCache } from "../schema";
import { firstOrNull } from "../utils/queries";
import type { DbResult } from "../types";

// ─── Wallet Links ────────────────────────────────────────────────────────────

export async function createWalletLink(data: {
  userId: string;
  walletAddress: string;
  label?: string | null;
  isPrimary?: boolean;
}) {
  const [link] = await db
    .insert(signerWalletLinks)
    .values({
      userId: data.userId,
      walletAddress: data.walletAddress.toLowerCase(),
      label: data.label ?? null,
      isPrimary: data.isPrimary ?? false,
      verifiedAt: new Date(),
    })
    .returning();
  return firstOrNull([link]);
}

export async function getWalletLinksByUser(userId: string) {
  return await db
    .select()
    .from(signerWalletLinks)
    .where(eq(signerWalletLinks.userId, userId))
    .orderBy(desc(signerWalletLinks.isPrimary), desc(signerWalletLinks.createdAt));
}

export async function getWalletLinkById(id: string) {
  const results = await db
    .select()
    .from(signerWalletLinks)
    .where(eq(signerWalletLinks.id, id))
    .limit(1);
  return firstOrNull(results);
}

export async function setPrimaryWallet(linkId: string, userId: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(signerWalletLinks)
      .set({ isPrimary: false })
      .where(eq(signerWalletLinks.userId, userId));
    await tx
      .update(signerWalletLinks)
      .set({ isPrimary: true })
      .where(eq(signerWalletLinks.id, linkId));
  });
  return getWalletLinkById(linkId);
}

export async function deleteWalletLink(linkId: string, userId: string): Promise<boolean> {
  try {
    await db
      .delete(signerWalletLinks)
      .where(
        and(eq(signerWalletLinks.id, linkId), eq(signerWalletLinks.userId, userId))
      );
    return true;
  } catch {
    return false;
  }
}

export async function getWalletLinksByAddress(walletAddress: string) {
  return await db
    .select()
    .from(signerWalletLinks)
    .where(eq(signerWalletLinks.walletAddress, walletAddress.toLowerCase()));
}

// ─── Queue Cache ─────────────────────────────────────────────────────────────

export async function upsertQueueCache(data: {
  walletAddress: string;
  safeId: string;
  orgId: string;
  pendingCount: number;
  pendingTxHashes?: string[];
}) {
  const [row] = await db
    .insert(signerQueueCache)
    .values({
      walletAddress: data.walletAddress.toLowerCase(),
      safeId: data.safeId,
      orgId: data.orgId,
      pendingCount: data.pendingCount,
      pendingTxHashes: data.pendingTxHashes ?? [],
    })
    .onConflictDoUpdate({
      target: [signerQueueCache.walletAddress, signerQueueCache.safeId],
      set: {
        pendingCount: data.pendingCount,
        pendingTxHashes: data.pendingTxHashes ?? [],
        updatedAt: new Date(),
      },
    })
    .returning();
  return firstOrNull([row]);
}

export async function getQueueCacheByAddress(walletAddress: string) {
  return await db
    .select()
    .from(signerQueueCache)
    .where(eq(signerQueueCache.walletAddress, walletAddress.toLowerCase()))
    .orderBy(desc(signerQueueCache.pendingCount));
}

export async function getQueueCacheByOrg(orgId: string) {
  return await db
    .select()
    .from(signerQueueCache)
    .where(eq(signerQueueCache.orgId, orgId));
}

export async function deleteQueueCacheBySafe(safeId: string) {
  await db.delete(signerQueueCache).where(eq(signerQueueCache.safeId, safeId));
}
