import { NextResponse } from "next/server";
import { generateSiweNonce } from "viem/siwe";
import { requireAuth } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const NONCE_EXPIRY_MINUTES = 5;

/** GET /api/profile/wallet-nonce – issue a SIWE nonce for the current user (link wallet flow). */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const nonce = generateSiweNonce();
  const expiresAt = new Date(Date.now() + NONCE_EXPIRY_MINUTES * 60 * 1000);

  await db
    .update(users)
    .set({
      pendingWalletNonce: nonce,
      pendingWalletNonceExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, auth.userId));

  return NextResponse.json({ nonce });
}
