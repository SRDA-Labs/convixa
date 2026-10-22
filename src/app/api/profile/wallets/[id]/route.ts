import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, parseRequestBody } from "@/lib/api-helpers";
import {
  getWalletLinkById,
  deleteWalletLink,
  setPrimaryWallet,
} from "@/lib/db/repositories";

/**
 * DELETE /api/profile/wallets/:id
 *
 * Unlink a wallet address from the user's profile.
 */
export async function DELETE(
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

  const deleted = await deleteWalletLink(id, auth.userId);
  if (!deleted) {
    return NextResponse.json(
      { error: "Failed to remove wallet" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

const updateWalletSchema = z.object({
  label: z.string().max(64).nullable().optional(),
});

/**
 * PATCH /api/profile/wallets/:id
 *
 * Update an existing wallet link (e.g. set or clear its label).
 */
export async function PATCH(
  req: Request,
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

  const parseResult = await parseRequestBody(req, updateWalletSchema);
  if ("error" in parseResult) return parseResult.error;
  const { label } = parseResult.data;

  // Update label — we don't have a dedicated repo function for this,
  // so we'll do it inline. The signer-wallets repo could be extended.
  const { db } = await import("@/lib/db");
  const { signerWalletLinks } = await import("@/lib/db/schema");
  const { eq, and } = await import("drizzle-orm");

  await db
    .update(signerWalletLinks)
    .set({ label: label ?? null })
    .where(and(eq(signerWalletLinks.id, id), eq(signerWalletLinks.userId, auth.userId)));

  return NextResponse.json({ ok: true, label });
}
