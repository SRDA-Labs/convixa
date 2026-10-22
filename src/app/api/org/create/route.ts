import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureDefaultOrgForUser } from "@/lib/org-bootstrap";

/** POST /api/org/create – ensure the signed-in user has a default org. */
export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const orgId = await ensureDefaultOrgForUser(userId);
  return NextResponse.json({ ok: true, orgId });
}
