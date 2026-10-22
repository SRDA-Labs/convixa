import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndOrg, parseRequestBody } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import {
  addTxThreadComment,
  incrementTxThreadCommentCount,
  logTxThreadActivity,
} from "@/lib/db/repositories/tx-proposals.repository";
import { createAuditLog } from "@/lib/db/repositories/audit.repository";
import { resolveTxProposalAccessByThread } from "@/lib/tx-proposals/service";
import { canCommentOnTxProposal } from "@/lib/tx-proposals/access";

const bodySchema = z.object({
  body: z.string().min(1).max(5000),
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
  if (!canCommentOnTxProposal(resolved.access)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await parseRequestBody(req, bodySchema);
  if ("error" in body) return body.error;

  const comment = await addTxThreadComment({
    threadId,
    userId: auth.userId,
    body: body.data.body.trim(),
  });
  if (!comment) {
    return NextResponse.json({ error: "Could not add comment" }, { status: 500 });
  }

  await incrementTxThreadCommentCount(threadId);

  const preview =
    body.data.body.trim().length > 120
      ? `${body.data.body.trim().slice(0, 120)}…`
      : body.data.body.trim();

  await logTxThreadActivity({
    threadId,
    userId: auth.userId,
    action: "comment_added",
    summary: "Added a comment",
    metadata: { preview, commentId: comment.id },
  });

  await createAuditLog({
    orgId: auth.orgId,
    userId: auth.userId,
    action: "tx.proposal.comment",
    resourceType: "safe",
    resourceId: resolved.safe.id,
    metadata: {
      threadId,
      safeTxHash: resolved.thread.safeTxHash,
      commentId: comment.id,
    },
  });

  return NextResponse.json({ comment }, { status: 201 });
}
