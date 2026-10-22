import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getAddress } from "viem";
import { requireAuth, validateSafeAccess } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import { db } from "@/lib/db";
import { users, signerWalletLinks } from "@/lib/db/schema";
import { getRosterById } from "@/lib/db/repositories/safe-signer-roster.repository";
import { verifyAffiliationSubmission } from "@/lib/signer-roster/verify-affiliation";

const bodySchema = z.object({
  message: z.string().min(1),
  signature: z.string().min(1),
});

async function userOwnsSignerAddress(userId: string, signerAddress: string): Promise<boolean> {
  const target = signerAddress.toLowerCase();
  const [user] = await db
    .select({ linkedWalletAddress: users.linkedWalletAddress })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.linkedWalletAddress?.toLowerCase() === target) return true;

  const links = await db
    .select({ walletAddress: signerWalletLinks.walletAddress })
    .from(signerWalletLinks)
    .where(eq(signerWalletLinks.userId, userId));

  return links.some((l) => l.walletAddress.toLowerCase() === target);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; rosterId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id, rosterId } = await params;
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(rosterId).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const access = await validateSafeAccess(id);
  if (access instanceof NextResponse) return access;
  const { safe } = access;

  const row = await getRosterById(rosterId);
  if (!row || row.safeId !== id || row.removedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ownsWallet = await userOwnsSignerAddress(auth.userId, row.signerAddress);
  if (!ownsWallet) {
    return NextResponse.json(
      { error: "Your linked wallet must match the roster signer address" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    getAddress(row.signerAddress);
  } catch {
    return NextResponse.json({ error: "Invalid signer address" }, { status: 400 });
  }

  const result = await verifyAffiliationSubmission({
    roster: row,
    message: parsed.data.message,
    signature: parsed.data.signature,
    signedByUserId: auth.userId,
    orgId: safe.orgId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, verificationStatus: "verified" });
}
