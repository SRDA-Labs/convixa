import { NextResponse } from "next/server";
import { getAddress, verifyMessage } from "viem";
import { parseSiweMessage } from "viem/siwe";
import { z } from "zod";
import { requireAuth, parseRequestBody } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createWalletLink } from "@/lib/db/repositories";

const linkWalletSchema = z.object({
  message: z.string().min(1),
  signature: z.string().min(1),
});

/** POST /api/profile/link-wallet – verify SIWE message + signature and link wallet to user. */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const parseResult = await parseRequestBody(req, linkWalletSchema);
  if ("error" in parseResult) return parseResult.error;
  const { message, signature } = parseResult.data;

  let parsed: { address?: string; nonce?: string; expirationTime?: Date; domain?: string };
  try {
    parsed = parseSiweMessage(message) as typeof parsed;
  } catch {
    return NextResponse.json({ error: "Invalid message format" }, { status: 400 });
  }

  const address = parsed.address;
  const nonce = parsed.nonce;
  if (!address || !nonce) {
    return NextResponse.json({ error: "Message missing address or nonce" }, { status: 400 });
  }

  const [user] = await db
    .select({
      id: users.id,
      pendingWalletNonce: users.pendingWalletNonce,
      pendingWalletNonceExpiresAt: users.pendingWalletNonceExpiresAt,
    })
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1);

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.pendingWalletNonce !== nonce) {
    return NextResponse.json({ error: "Invalid or expired nonce" }, { status: 400 });
  }
  if (!user.pendingWalletNonceExpiresAt || new Date(user.pendingWalletNonceExpiresAt) <= new Date()) {
    return NextResponse.json({ error: "Nonce expired" }, { status: 400 });
  }

  if (parsed.expirationTime && new Date(parsed.expirationTime) <= new Date()) {
    return NextResponse.json({ error: "Message expired" }, { status: 400 });
  }

  const valid = await verifyMessage({
    address: address as `0x${string}`,
    message,
    signature: signature as `0x${string}`,
  });
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const checksummed = getAddress(address);

  await db
    .update(users)
    .set({
      linkedWalletAddress: checksummed,
      pendingWalletNonce: null,
      pendingWalletNonceExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, auth.userId));

  // Also create a signer_wallet_links row for multi-wallet support (Plan 05)
  await createWalletLink({
    userId: auth.userId,
    walletAddress: checksummed,
    isPrimary: true,
  });

  return NextResponse.json({ address: checksummed });
}
