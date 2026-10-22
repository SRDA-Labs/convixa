import {
  getTxThreadBySafeTx,
  logTxThreadActivity,
} from "@/lib/db/repositories/tx-proposals.repository";

/** Append checklist lifecycle events to an open proposal thread when one exists. */
export async function logTxProposalChecklistActivity(
  safeId: string,
  safeTxHash: string,
  userId: string,
  action: "checklist_completed" | "signed",
  userLabel?: string
) {
  const thread = await getTxThreadBySafeTx(safeId, safeTxHash);
  if (!thread || thread.status !== "open") return;

  const label = userLabel ?? "A signer";
  const summary =
    action === "signed"
      ? `${label} marked their pre-sign checklist as signed`
      : `${label} completed their pre-sign checklist`;

  await logTxThreadActivity({
    threadId: thread.id,
    userId,
    action,
    summary,
    metadata: { safeTxHash: thread.safeTxHash },
  });
}
