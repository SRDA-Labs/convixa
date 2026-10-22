import { NextResponse } from "next/server";
import { z } from "zod";
import { getAddress } from "viem";
import {
  getVerificationRequestByTokenHash,
  getRosterById,
  updateVerificationRequest,
} from "@/lib/db/repositories/safe-signer-roster.repository";
import { db } from "@/lib/db";
import { safes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  hashVerificationToken,
  verifyAffiliationSubmission,
  issueAffiliationChallenge,
  getOrgName,
} from "@/lib/signer-roster/verify-affiliation";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const tokenHash = hashVerificationToken(token);
  const request = await getVerificationRequestByTokenHash(tokenHash);
  if (!request || request.status !== "pending") {
    return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });
  }

  if (new Date(request.expiresAt) <= new Date()) {
    await updateVerificationRequest(request.id, { status: "expired" });
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  const roster = await getRosterById(request.rosterId);
  if (!roster || roster.removedAt) {
    return NextResponse.json({ error: "Roster entry not found" }, { status: 404 });
  }

  const [safe] = await db.select().from(safes).where(eq(safes.id, roster.safeId)).limit(1);
  if (!safe) return NextResponse.json({ error: "Safe not found" }, { status: 404 });

  const orgName = await getOrgName(safe.orgId);
  const challenge = await issueAffiliationChallenge(roster, {
    safeAddress: safe.address,
    network: safe.network,
    orgName,
    safePurpose: safe.purpose ?? "",
  });

  return NextResponse.json({
    orgName,
    safeAddress: safe.address,
    network: safe.network,
    signerAddress: roster.signerAddress,
    displayName: roster.displayName,
    message: challenge.message,
    requestId: challenge.requestId,
    expiresAt: challenge.expiresAt.toISOString(),
  });
}

const postSchema = z.object({
  message: z.string().min(1),
  signature: z.string().min(1),
  walletAddress: z.string().min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const tokenHash = hashVerificationToken(token);
  const request = await getVerificationRequestByTokenHash(tokenHash);
  if (!request || request.status !== "pending") {
    return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });
  }

  if (new Date(request.expiresAt) <= new Date()) {
    await updateVerificationRequest(request.id, { status: "expired" });
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const roster = await getRosterById(request.rosterId);
  if (!roster || roster.removedAt) {
    return NextResponse.json({ error: "Roster entry not found" }, { status: 404 });
  }

  let wallet: string;
  try {
    wallet = getAddress(parsed.data.walletAddress);
  } catch {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  if (wallet.toLowerCase() !== roster.signerAddress.toLowerCase()) {
    return NextResponse.json(
      { error: "Connected wallet must match the roster signer address" },
      { status: 403 }
    );
  }

  const result = await verifyAffiliationSubmission({
    roster,
    message: parsed.data.message,
    signature: parsed.data.signature,
    signedByUserId: null,
    orgId: request.orgId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await updateVerificationRequest(request.id, { status: "completed" });

  return NextResponse.json({ ok: true });
}
