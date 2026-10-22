import { fetchTxSnapshotOrExecuted } from "@/lib/tx-proposals/snapshot";
import {
  getTxThreadById,
  updateTxThreadStatus,
  logTxThreadActivity,
} from "@/lib/db/repositories/tx-proposals.repository";
import type { pendingTxThreads } from "@/lib/db/schema/operational-workflows.schema";

type ThreadRow = typeof pendingTxThreads.$inferSelect;

/** Refresh thread status from Safe API when still open. */
export async function refreshTxThreadLifecycle(
  thread: ThreadRow,
  safe: { network: string; address: string }
): Promise<ThreadRow> {
  if (thread.status !== "open") return thread;

  const result = await fetchTxSnapshotOrExecuted(
    safe.network,
    safe.address,
    thread.safeTxHash
  );

  if (!result) return thread;

  if (result.executed) {
    const updated = await updateTxThreadStatus(thread.id, {
      status: "executed",
      executedAt: new Date(),
      txSnapshot: { ...result.snapshot, executed: true },
    });
    if (updated) {
      await logTxThreadActivity({
        threadId: thread.id,
        action: "status_changed",
        summary: "Transaction executed on-chain",
        metadata: { from: "open", to: "executed" },
      });
    }
    return updated ?? thread;
  }

  return thread;
}

export async function refreshTxThreadLifecycleById(
  threadId: string,
  safe: { network: string; address: string }
): Promise<ThreadRow | null> {
  const thread = await getTxThreadById(threadId);
  if (!thread) return null;
  return refreshTxThreadLifecycle(thread, safe);
}
