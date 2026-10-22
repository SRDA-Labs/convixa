import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { requireAuthAndOrg, parseRequestBody } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import { db } from "@/lib/db";
import { orgMembers, users } from "@/lib/db/schema";
import {
  addTxThreadParticipant,
  getTxThreadParticipants,
  logTxThreadActivity,
} from "@/lib/db/repositories/tx-proposals.repository";
import { resolveTxProposalAccessByThread } from "@/lib/tx-proposals/service";
import { canInviteToTxProposal } from "@/lib/tx-proposals/access";

const bodySchema = z.object({
  userId: z.string().uuid(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  const { threadId } = await params;
  if (!uuidSchema.safeParse(threadId).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const resolved = await resolveTxProposalAccessByThread(
    threadId,
    auth.userId,
    auth.orgId
  );
  if (!resolved || !resolved.thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canInviteToTxProposal(resolved.access)) {
    return NextResponse.json(
      { error: "Only team members can invite collaborators" },
      { status: 403 }
    );
  }

  const body = await parseRequestBody(req, bodySchema);
  if ("error" in body) return body.error;

  const [member] = await db
    .select({ userId: orgMembers.userId })
    .from(orgMembers)
    .where(
      and(eq(orgMembers.orgId, auth.orgId), eq(orgMembers.userId, body.data.userId))
    )
    .limit(1);

  if (!member) {
    return NextResponse.json(
      { error: "User is not a member of this organization" },
      { status: 400 }
    );
  }

  const existing = await getTxThreadParticipants(threadId);
  if (existing.some((p) => p.userId === body.data.userId)) {
    return NextResponse.json({ error: "User already has access" }, { status: 409 });
  }

  const participant = await addTxThreadParticipant({
    threadId,
    userId: body.data.userId,
    invitedByUserId: auth.userId,
    role: "collaborator",
  });

  if (!participant) {
    return NextResponse.json({ error: "Could not add participant" }, { status: 500 });
  }

  const [invitedUser] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, body.data.userId))
    .limit(1);

  const label = invitedUser?.name ?? invitedUser?.email ?? "A team member";

  await logTxThreadActivity({
    threadId,
    userId: auth.userId,
    action: "participant_invited",
    summary: `Invited ${label} to the discussion`,
    metadata: { invitedUserId: body.data.userId },
  });

  return NextResponse.json({ participant }, { status: 201 });
}
