import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, verificationTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email";
import { ensureDefaultOrgForUser } from "@/lib/org-bootstrap";
import crypto from "crypto";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 10;
const VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000;

const bodySchema = z.object({
  email: z.string().email("Invalid email").max(255).transform((s) => s.trim().toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters").max(512),
  name: z.string().max(255).optional().transform((s) => (s ? s.trim() : undefined)),
});

/** POST /api/auth/register – create user + default org. First user becomes org owner. */
export async function POST(req: NextRequest) {
  const identifier = getClientIdentifier(req);
  const { ok: withinLimit, remaining, resetAt } = checkRateLimit(identifier, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX);
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Too many sign-up attempts. Try again later." },
      { status: 429, headers: { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)) } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const message = first.email?.[0] ?? first.password?.[0] ?? "Invalid input";
    return NextResponse.json(
      { error: message, details: parsed.error.flatten() },
      { status: 400, headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
  }
  const { email, password, name } = parsed.data;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409, headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
  }

  const passwordHash = await hash(password, 10);

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      name: name ?? null,
      passwordHash,
    })
    .returning();
  if (!newUser) {
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }

  await ensureDefaultOrgForUser(newUser.id, { audit: true });

  const verifyToken = crypto.randomUUID();
  const verifyExpires = new Date(Date.now() + VERIFICATION_EXPIRY_MS);
  await db.insert(verificationTokens).values({
    identifier: email,
    token: verifyToken,
    expires: verifyExpires,
  });
  const baseUrl = (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3001").replace(/\/$/, "");
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${verifyToken}`;
  sendVerificationEmail(email, verifyUrl).catch((err) =>
    console.error("[register] Verification email failed:", err)
  );

  return NextResponse.json(
    {
      ok: true,
      message: "Account created. Signing you in…",
    },
    { headers: { "X-RateLimit-Remaining": String(remaining) } }
  );
}
