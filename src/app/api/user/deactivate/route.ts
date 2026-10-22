import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "crypto";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, otpCodes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { parseRequestBody } from "@/lib/api-helpers";
import { sendOtpEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";

const OTP_EXPIRY_MS = 10 * 60 * 1000;

const deactivateSchema = z.object({
  action: z.enum(["send_otp", "confirm"]),
  otp: z.string().optional(),
});

/**
 * POST /api/user/deactivate
 *
 * Unified account deactivation flow:
 *   { action: "send_otp" }       — Send verification OTP to user's email
 *   { action: "confirm", otp }    — Verify OTP and permanently deactivate account
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const parseResult = await parseRequestBody(req, deactivateSchema);
  if ("error" in parseResult) return parseResult.error;
  const { action, otp } = parseResult.data;

  // ── action: send_otp ──────────────────────────────────────────────────
  if (action === "send_otp") {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user?.email) {
      return NextResponse.json({ error: "User has no email" }, { status: 400 });
    }

    const code = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await db
      .delete(otpCodes)
      .where(and(eq(otpCodes.userId, userId), eq(otpCodes.purpose, "deactivate_account")));

    await db.insert(otpCodes).values({
      userId,
      code,
      purpose: "deactivate_account",
      expiresAt,
    });

    const sent = await sendOtpEmail(user.email, code, "deactivate_account");
    if (!sent) {
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  // ── action: confirm ───────────────────────────────────────────────────
  const code = otp?.trim();
  if (!code) {
    return NextResponse.json({ error: "Verification code is required" }, { status: 400 });
  }

  const [row] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.userId, userId),
        eq(otpCodes.purpose, "deactivate_account"),
        eq(otpCodes.code, code)
      )
    )
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Invalid or expired verification code" }, { status: 400 });
  }
  if (new Date(row.expiresAt) <= new Date()) {
    await db.delete(otpCodes).where(eq(otpCodes.id, row.id));
    return NextResponse.json({ error: "Verification code has expired. Please request a new one." }, { status: 400 });
  }

  await db.delete(otpCodes).where(eq(otpCodes.id, row.id));

  const userEmail = (session.user as { email?: string }).email;
  await logAudit({
    orgId: "00000000-0000-0000-0000-000000000000",
    userId,
    action: "account.deactivated",
    resourceType: "user",
    resourceId: userId,
    metadata: { email: userEmail },
  }).catch(() => {});

  await db.delete(users).where(eq(users.id, userId));

  return NextResponse.json({ ok: true });
}
