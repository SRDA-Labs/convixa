export const TX_THREAD_STATUSES = ["open", "executed", "superseded"] as const;
export type TxThreadStatus = (typeof TX_THREAD_STATUSES)[number];

export const TX_THREAD_STATUS_LABEL: Record<TxThreadStatus, string> = {
  open: "Open",
  executed: "Executed",
  superseded: "Superseded",
};

export const TX_THREAD_ACTIVITY_ACTIONS = [
  "thread_opened",
  "comment_added",
  "participant_invited",
  "checklist_completed",
  "signed",
  "status_changed",
] as const;

export type TxThreadActivityAction = (typeof TX_THREAD_ACTIVITY_ACTIONS)[number];

export const TX_THREAD_PARTICIPANT_ROLES = ["collaborator"] as const;
