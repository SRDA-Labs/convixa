import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** POST /api/auth/revoke-sessions
 *  Revoke all active sessions for the current user by setting sessions_revoked_at.
 *  Used on logout, password change, or admin-forced session invalidation.
 *  Any JWT issued before sessions_revoked_at will be rejected by getCurrentUser(). */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .update(users)
    .set({ sessionsRevokedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  const res = NextResponse.json({ ok: true });
  return res;
}
