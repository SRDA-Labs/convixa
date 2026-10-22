import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { users, signerWalletLinks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** POST /api/profile/unlink-wallet – remove linked wallet from current user. */
export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Remove the legacy linkedWalletAddress
  await db
    .update(users)
    .set({
      linkedWalletAddress: null,
      pendingWalletNonce: null,
      pendingWalletNonceExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, auth.userId));

  // Also clean up any signer_wallet_links for this user
  await db
    .delete(signerWalletLinks)
    .where(eq(signerWalletLinks.userId, auth.userId));

  return NextResponse.json({ ok: true });
}
