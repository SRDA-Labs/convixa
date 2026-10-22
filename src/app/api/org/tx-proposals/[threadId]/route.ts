import { NextResponse } from "next/server";
import { requireAuthAndOrg } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import {
  getTxThreadDetail,
  getTxThreadCommentsWithUsers,
  getTxThreadParticipants,
  getTxThreadActivity,
} from "@/lib/db/repositories/tx-proposals.repository";
import { resolveTxProposalAccessByThread } from "@/lib/tx-proposals/service";
import { refreshTxThreadLifecycleById } from "@/lib/tx-proposals/lifecycle";
import { fetchTxSnapshotForHash } from "@/lib/tx-proposals/snapshot";

export async function GET(
  _req: Request,
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
  if (!resolved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!resolved.canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await refreshTxThreadLifecycleById(threadId, {
    network: resolved.safe.network,
    address: resolved.safe.address,
  });

  const [thread, comments, participants, activity] = await Promise.all([
    getTxThreadDetail(threadId),
    getTxThreadCommentsWithUsers(threadId),
    getTxThreadParticipants(threadId),
    getTxThreadActivity(threadId, 50),
  ]);

  const liveTx = await fetchTxSnapshotForHash(
    resolved.safe.network,
    resolved.safe.address,
    resolved.thread!.safeTxHash
  );

  return NextResponse.json({
    thread,
    comments,
    participants,
    activity,
    liveTx,
    capabilities: resolved.capabilities,
  });
}
