import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, otpCodes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { sendOtpEmail } from "@/lib/email";
import crypto from "crypto";

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/** POST /api/user/2fa/send-otp – generate OTP, store it, send email (for enabling 2FA) */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const [user] = await db.select({ email: users.email, twoFactorEnabled: users.twoFactorEnabled }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.email) {
    return NextResponse.json({ error: "User has no email" }, { status: 400 });
  }
  if (user.twoFactorEnabled) {
    return NextResponse.json({ error: "2FA is already enabled" }, { status: 400 });
  }

  const otp = String(crypto.randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await db.delete(otpCodes).where(and(eq(otpCodes.userId, userId), eq(otpCodes.purpose, "enable_2fa")));
  await db.insert(otpCodes).values({
    userId,
    code: otp,
    purpose: "enable_2fa",
    expiresAt,
  });

  const sent = await sendOtpEmail(user.email, otp, "enable_2fa");
  if (!sent) {
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
