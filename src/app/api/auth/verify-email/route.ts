import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, verificationTokens } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";

/**
 * GET /api/auth/verify-email?token=xxx
 * Verifies the user's email and redirects to dashboard.
 * Also callable as POST for programmatic verification.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const result = await verifyAndMark(token);
  if (result instanceof NextResponse) {
    // Redirect to dashboard with success/error
    const err = (await result.json()) as { error: string };
    return redirect(`/dashboard?verify=${err.error ? "error" : "success"}&message=${encodeURIComponent(err.error || "Email verified!")}`);
  }
  return redirect("/dashboard?verify=success");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  return verifyAndMark(token);
}

async function verifyAndMark(token: string) {
  const [vt] = await db
    .select()
    .from(verificationTokens)
    .where(and(eq(verificationTokens.token, token)))
    .limit(1);

  if (!vt) {
    return NextResponse.json({ error: "Invalid or expired verification link" }, { status: 400 });
  }
  if (new Date(vt.expires) <= new Date()) {
    await db.delete(verificationTokens).where(eq(verificationTokens.token, token));
    return NextResponse.json({ error: "Verification link has expired. Please register again." }, { status: 400 });
  }

  // Mark email as verified
  await db
    .update(users)
    .set({ emailVerified: new Date(), updatedAt: new Date() })
    .where(eq(users.email, vt.identifier));

  // Clean up the token
  await db.delete(verificationTokens).where(eq(verificationTokens.token, token));

  return NextResponse.json({ ok: true, message: "Email verified successfully" });
}
