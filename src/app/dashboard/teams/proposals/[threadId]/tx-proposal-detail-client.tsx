"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  History,
  Loader2,
  MessageSquare,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { TX_THREAD_STATUS_LABEL } from "@/lib/tx-proposals/constants";
import { getSafeAppUrl } from "@/lib/safe-api";
import { orgHubUrl } from "@/lib/org-management/constants";

type Capabilities = {
  canView: boolean;
  canStart: boolean;
  canComment: boolean;
  canInvite: boolean;
};

type ThreadDetail = {
  id: string;
  safeId: string;
  safeTxHash: string;
  status: string;
  txSnapshot: {
    txType: string;
    to: string;
    value: string;
    nonce: number;
    submissionDate: string;
    confirmations: number;
    confirmationsRequired: number;
  } | null;
  commentCount: number;
  createdAt: string;
  executedAt: string | null;
  safeName: string | null;
  safeAddress: string;
  network: string;
  teamName: string | null;
  openerName: string | null;
  openerEmail: string | null;
};

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  userName: string | null;
  userEmail: string;
};

type Participant = {
  id: string;
  userId: string;
  role: string;
  userName: string | null;
  userEmail: string;
};

type Activity = {
  id: string;
  action: string;
  summary: string;
  createdAt: string;
  userName: string | null;
};

type OrgMember = {
  userId: string;
  email: string;
  name: string | null;
};

function statusClass(s: string): string {
  if (s === "executed") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (s === "superseded") return "bg-muted text-muted-foreground";
  return "bg-primary/10 text-primary";
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatValue(wei: string): string {
  try {
    const n = BigInt(wei);
    if (n === BigInt(0)) return "0";
    const eth = Number(n) / 1e18;
    if (eth >= 1) return `${eth.toFixed(4)} ETH`;
    if (eth >= 0.001) return `${eth.toFixed(6)} ETH`;
    return "< 0.001 ETH";
  } catch {
    return wei;
  }
}

function truncate(addr: string, start = 8, end = 6): string {
  if (addr.length <= start + end) return addr;
  return `${addr.slice(0, start)}…${addr.slice(-end)}`;
}

export function TxProposalDetailClient({ threadId }: { threadId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);

  const [comment, setComment] = useState("");
  const [activityExpanded, setActivityExpanded] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [inviteUserId, setInviteUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/org/tx-proposals/${threadId}`);
      if (res.status === 403) {
        setError("You do not have access to this discussion.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError("Discussion not found.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setThread(data.thread);
      setComments(data.comments ?? []);
      setParticipants(data.participants ?? []);
      setActivity(data.activity ?? []);
      setCapabilities(data.capabilities ?? null);
    } catch {
      setError("Failed to load discussion.");
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!inviteOpen || members.length > 0) return;
    fetch("/api/members")
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((d) => {
        setMembers(
          (d.members ?? []).map((m: { userId: string; email: string; name: string | null }) => ({
            userId: m.userId,
            email: m.email,
            name: m.name,
          }))
        );
      })
      .catch(() => {});
  }, [inviteOpen, members.length]);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/org/tx-proposals/${threadId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: comment.trim() }),
      });
      if (res.ok) {
        setComment("");
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteUserId || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/org/tx-proposals/${threadId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: inviteUserId }),
      });
      if (res.ok) {
        setInviteUserId("");
        setInviteOpen(false);
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="space-y-4">
        <Link
          href={orgHubUrl("proposals")}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to proposals
        </Link>
        <p className="text-sm text-muted-foreground">{error ?? "Not found"}</p>
      </div>
    );
  }

  const snap = thread.txSnapshot;
  const safeAppUrl = getSafeAppUrl(thread.network, thread.safeAddress);
  const statusLabel =
    TX_THREAD_STATUS_LABEL[thread.status as keyof typeof TX_THREAD_STATUS_LABEL] ?? thread.status;
  const isOpen = thread.status === "open";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <Link
            href={orgHubUrl("proposals")}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Team proposals
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-semibold text-foreground">
              {snap?.txType ?? "Pending transaction"}
            </h1>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                statusClass(thread.status)
              )}
            >
              {statusLabel}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            <Link href={`/dashboard/safes/${thread.safeId}`} className="text-primary hover:underline">
              {thread.safeName ?? truncate(thread.safeAddress)}
            </Link>
            {thread.teamName && <> · {thread.teamName}</>}
            {thread.openerName && <> · opened by {thread.openerName}</>}
          </p>
        </div>
        <a
          href={safeAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
        >
          View on Safe
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-5">
          {snap && (
            <div className="rounded-lg border border-border bg-card p-4 text-xs space-y-2">
              <h2 className="font-medium text-foreground">Transaction summary</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-muted-foreground">
                <dt>To</dt>
                <dd className="font-mono text-foreground truncate" title={snap.to}>
                  {truncate(snap.to, 10, 8)}
                </dd>
                <dt>Value</dt>
                <dd className="text-foreground">{formatValue(snap.value)}</dd>
                <dt>Nonce</dt>
                <dd className="text-foreground tabular-nums">{snap.nonce}</dd>
                <dt>Confirmations</dt>
                <dd className="text-foreground tabular-nums">
                  {snap.confirmations}/{snap.confirmationsRequired}
                </dd>
                <dt>Submitted</dt>
                <dd className="text-foreground">{formatWhen(snap.submissionDate)}</dd>
                <dt>Tx hash</dt>
                <dd className="font-mono text-[10px] text-foreground truncate" title={thread.safeTxHash}>
                  {truncate(thread.safeTxHash, 12, 8)}
                </dd>
              </dl>
            </div>
          )}

          <section className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-4 py-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-foreground">Discussion</h2>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {comments.length} comment{comments.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="p-4 space-y-4 min-h-[120px]">
              {comments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No comments yet. Start the conversation about this proposal.
                </p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-baseline gap-2 text-[11px]">
                      <span className="font-medium text-foreground">
                        {c.userName ?? c.userEmail}
                      </span>
                      <span className="text-muted-foreground">{formatWhen(c.createdAt)}</span>
                    </div>
                    <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                      {c.body}
                    </p>
                  </div>
                ))
              )}
            </div>
            {capabilities?.canComment && isOpen && (
              <form onSubmit={submitComment} className="border-t border-border p-4 space-y-2">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment for your team…"
                  rows={3}
                  maxLength={5000}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-y focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="submit"
                  disabled={!comment.trim() || submitting}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                  Post comment
                </button>
              </form>
            )}
            {!isOpen && (
              <p className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
                This discussion is read-only — the transaction is no longer open.
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {capabilities?.canInvite && isOpen && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" />
                  Invite collaborator
                </h3>
                <button
                  type="button"
                  onClick={() => setInviteOpen(!inviteOpen)}
                  className="text-[10px] text-primary hover:underline"
                >
                  {inviteOpen ? "Cancel" : "Invite"}
                </button>
              </div>
              {inviteOpen && (
                <form onSubmit={submitInvite} className="space-y-2">
                  <select
                    value={inviteUserId}
                    onChange={(e) => setInviteUserId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                  >
                    <option value="">Select org member…</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name ?? m.email}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={!inviteUserId || submitting}
                    className="w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Send invite
                  </button>
                </form>
              )}
              {participants.length > 0 && (
                <ul className="text-[11px] text-muted-foreground space-y-1 pt-1 border-t border-border">
                  {participants.map((p) => (
                    <li key={p.id}>
                      {p.userName ?? p.userEmail}
                      <span className="text-[10px] ml-1">(invited)</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setActivityExpanded(!activityExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-foreground hover:bg-muted/30"
            >
              <span className="flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                Activity
              </span>
              {activityExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            {activityExpanded && (
              <ul className="border-t border-border px-4 py-3 space-y-2 max-h-64 overflow-y-auto">
                {activity.length === 0 ? (
                  <li className="text-[11px] text-muted-foreground">No activity yet.</li>
                ) : (
                  activity.map((a) => (
                    <li key={a.id} className="text-[11px]">
                      <p className="text-foreground">{a.summary}</p>
                      <p className="text-muted-foreground">
                        {formatWhen(a.createdAt)}
                        {a.userName && ` · ${a.userName}`}
                      </p>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
