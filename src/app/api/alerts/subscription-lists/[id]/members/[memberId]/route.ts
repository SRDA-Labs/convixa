import { NextResponse } from "next/server";
import { requireAuthOrgPermission } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import { db } from "@/lib/db";
import { subscriptionListMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSubscriptionListById, removeSubscriptionListMember } from "@/lib/db/repositories/subscription-lists.repository";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const { id, memberId } = await params;
  const idParsed = uuidSchema.safeParse(id);
  const memberIdParsed = uuidSchema.safeParse(memberId);
  if (!idParsed.success || !memberIdParsed.success) return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });

  const list = await getSubscriptionListById(idParsed.data);
  if (!list || list.organizationId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db
    .select()
    .from(subscriptionListMembers)
    .where(
      and(
        eq(subscriptionListMembers.id, memberIdParsed.data),
        eq(subscriptionListMembers.subscriptionListId, idParsed.data)
      )
    )
    .limit(1);
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const ok = await removeSubscriptionListMember(memberIdParsed.data);
  if (!ok) return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
