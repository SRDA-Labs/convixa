import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, otpCodes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { sendOtpEmail } from "@/lib/email";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import crypto from "crypto";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 min
const RATE_LIMIT_MAX = 20; // attempts per window

const bodySchema = z.object({
  email: z.string().email("Invalid email").max(255).transform((s) => s.trim().toLowerCase()),
  password: z.string().min(1, "Password required").max(512),
});

/** POST /api/auth/check-login – body { email, password }. Validate credentials; if 2FA enabled, send OTP and return requireOtp */
export async function POST(req: NextRequest) {
  const identifier = getClientIdentifier(req);
  const { ok: withinLimit, remaining, resetAt } = checkRateLimit(identifier, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX);
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429, headers: { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)) } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Email and password required", details: parsed.error.flatten() },
      { status: 400, headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
  }
  const { email, password } = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user?.passwordHash) {
    // Log failed login attempt (user not found or no password)
    logAudit({
      orgId: "00000000-0000-0000-0000-000000000000", // no org context for login
      userId: null,
      action: "login.failed",
      resourceType: "auth",
      metadata: { email, reason: "user_not_found_or_no_password", ip: identifier },
    }).catch(() => {});
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const passwordsMatch = await compare(password, user.passwordHash);
  if (!passwordsMatch) {
    logAudit({
      orgId: "00000000-0000-0000-0000-000000000000",
      userId: user.id,
      action: "login.failed",
      resourceType: "auth",
      metadata: { email, reason: "wrong_password", ip: identifier },
    }).catch(() => {});
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  if (user.twoFactorEnabled !== true) {
    logAudit({
      orgId: "00000000-0000-0000-0000-000000000000",
      userId: user.id,
      action: "login.success",
      resourceType: "auth",
      metadata: { email, ip: identifier },
    }).catch(() => {});
    return NextResponse.json({ success: true });
  }

  const otp = String(crypto.randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await db.delete(otpCodes).where(and(eq(otpCodes.userId, user.id), eq(otpCodes.purpose, "login")));
  await db.insert(otpCodes).values({
    userId: user.id,
    code: otp,
    purpose: "login",
    expiresAt,
  });

  const sent = await sendOtpEmail(user.email!, otp, "login");
  if (!sent) {
    return NextResponse.json({ error: "Failed to send verification email" }, { status: 500 });
  }
  return NextResponse.json({ requireOtp: true });
}
