import { NextResponse } from "next/server";
import { requireAuthAndOrg, validateSafeAccess } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import {
  createTxThread,
  getTxThreadBySafeTx,
  logTxThreadActivity,
} from "@/lib/db/repositories/tx-proposals.repository";
import { createAuditLog } from "@/lib/db/repositories/audit.repository";
import { resolveTxProposalAccessBySafeTx } from "@/lib/tx-proposals/service";
import { fetchTxSnapshotForHash } from "@/lib/tx-proposals/snapshot";
import { refreshTxThreadLifecycle } from "@/lib/tx-proposals/lifecycle";
import { canStartTxProposal } from "@/lib/tx-proposals/access";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; safeTxHash: string }> }
) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  const { id, safeTxHash: rawHash } = await params;
  const safeTxHash = decodeURIComponent(rawHash);
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid safe id" }, { status: 400 });
  }

  const access = await validateSafeAccess(id);
  if (access instanceof NextResponse) return access;

  const resolved = await resolveTxProposalAccessBySafeTx(
    id,
    safeTxHash,
    auth.userId,
    auth.orgId
  );
  if (!resolved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!resolved.canView && !resolved.capabilities.canStart) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let thread = resolved.thread;
  if (thread && thread.status === "open") {
    thread = await refreshTxThreadLifecycle(thread, {
      network: resolved.safe.network,
      address: resolved.safe.address,
    });
  }

  const liveTx = await fetchTxSnapshotForHash(
    resolved.safe.network,
    resolved.safe.address,
    safeTxHash
  );

  return NextResponse.json({
    thread,
    liveTx,
    safe: {
      id: resolved.safe.id,
      name: resolved.safe.name,
      address: resolved.safe.address,
      network: resolved.safe.network,
    },
    capabilities: resolved.capabilities,
    threadUrl: thread ? `/dashboard/teams/proposals/${thread.id}` : null,
  });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; safeTxHash: string }> }
) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  const { id, safeTxHash: rawHash } = await params;
  const safeTxHash = decodeURIComponent(rawHash);
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid safe id" }, { status: 400 });
  }

  const access = await validateSafeAccess(id);
  if (access instanceof NextResponse) return access;
  const { safe } = access;

  const resolved = await resolveTxProposalAccessBySafeTx(
    id,
    safeTxHash,
    auth.userId,
    auth.orgId
  );
  if (!resolved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canStartTxProposal(resolved.access)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await getTxThreadBySafeTx(id, safeTxHash);
  if (existing) {
    return NextResponse.json(
      { thread: existing, threadUrl: `/dashboard/teams/proposals/${existing.id}` },
      { status: 200 }
    );
  }

  const snapshot = await fetchTxSnapshotForHash(safe.network, safe.address, safeTxHash);
  if (!snapshot) {
    return NextResponse.json(
      { error: "Could not find this pending transaction on Safe" },
      { status: 404 }
    );
  }

  const thread = await createTxThread({
    orgId: safe.orgId,
    safeId: safe.id,
    safeTxHash,
    openedByUserId: auth.userId,
    txSnapshot: snapshot,
  });

  if (!thread) {
    return NextResponse.json({ error: "Could not create discussion" }, { status: 500 });
  }

  await logTxThreadActivity({
    threadId: thread.id,
    userId: auth.userId,
    action: "thread_opened",
    summary: "Started team discussion for this pending transaction",
    metadata: { safeTxHash: thread.safeTxHash },
  });

  await createAuditLog({
    orgId: safe.orgId,
    userId: auth.userId,
    action: "tx.proposal.opened",
    resourceType: "safe",
    resourceId: safe.id,
    metadata: { safeTxHash: thread.safeTxHash, threadId: thread.id },
  });

  return NextResponse.json(
    { thread, threadUrl: `/dashboard/teams/proposals/${thread.id}` },
    { status: 201 }
  );
}
