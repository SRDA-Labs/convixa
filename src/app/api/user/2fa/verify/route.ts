import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, otpCodes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

/** POST /api/user/2fa/verify – body { otp }. Verify OTP and enable 2FA */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const userEmail = (session.user as { email?: string }).email;
  const body = await req.json().catch(() => ({}));
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  if (!otp) {
    return NextResponse.json({ error: "OTP required" }, { status: 400 });
  }

  const [row] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.userId, userId), eq(otpCodes.purpose, "enable_2fa"), eq(otpCodes.code, otp)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }
  if (new Date(row.expiresAt) <= new Date()) {
    await db.delete(otpCodes).where(eq(otpCodes.id, row.id));
    return NextResponse.json({ error: "Code expired" }, { status: 400 });
  }

  await db.delete(otpCodes).where(eq(otpCodes.id, row.id));
  await db.update(users).set({ twoFactorEnabled: true, updatedAt: new Date() }).where(eq(users.id, userId));

  logAudit({
    orgId: "00000000-0000-0000-0000-000000000000",
    userId,
    action: "2fa.enabled",
    resourceType: "user",
    resourceId: userId,
    metadata: { email: userEmail },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
