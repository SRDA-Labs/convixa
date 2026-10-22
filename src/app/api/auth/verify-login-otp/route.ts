import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, otpCodes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import crypto from "crypto";

const LOGIN_TOKEN_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 min
const RATE_LIMIT_MAX = 15; // OTP verify attempts per window

const bodySchema = z.object({
  email: z.string().email("Invalid email").max(255).transform((s) => s.trim().toLowerCase()),
  password: z.string().min(1, "Password required").max(512),
  otp: z.string().min(1, "OTP required").max(16).transform((s) => s.trim()),
});

/** POST /api/auth/verify-login-otp – body { email, password, otp }. Verify OTP and return one-time loginToken */
export async function POST(req: NextRequest) {
  const identifier = getClientIdentifier(req);
  const { ok: withinLimit, remaining, resetAt } = checkRateLimit(identifier, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX);
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)) } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Email, password and OTP required", details: parsed.error.flatten() },
      { status: 400, headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
  }
  const { email, password, otp } = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Invalid request" }, { status: 401 });
  }
  const ok = await compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid request" }, { status: 401 });
  }

  const [row] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.userId, user.id), eq(otpCodes.purpose, "login"), eq(otpCodes.code, otp)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }
  if (new Date(row.expiresAt) <= new Date()) {
    await db.delete(otpCodes).where(eq(otpCodes.id, row.id));
    return NextResponse.json({ error: "Code expired" }, { status: 400 });
  }

  await db.delete(otpCodes).where(eq(otpCodes.id, row.id));

  const loginToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + LOGIN_TOKEN_EXPIRY_MS);
  await db.insert(otpCodes).values({
    userId: user.id,
    code: loginToken,
    purpose: "login_token",
    expiresAt,
  });

  return NextResponse.json({ loginToken });
}
