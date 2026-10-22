"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MessageSquare, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/cn";
import { TX_THREAD_STATUS_LABEL } from "@/lib/tx-proposals/constants";

type ThreadRow = {
  id: string;
  safeId: string;
  safeTxHash: string;
  status: string;
  commentCount: number;
  lastActivityAt: string | null;
  createdAt: string;
  safeName: string | null;
  safeAddress: string;
  network: string;
  teamName: string | null;
  txSnapshot: { txType: string; submissionDate: string } | null;
  openerName: string | null;
};

type PendingRow = {
  safeId: string;
  safeName: string | null;
  safeAddress: string;
  safeTxHash: string;
  txType: string;
  submissionDate: string;
  teamId: string;
};

function statusClass(s: string): string {
  if (s === "executed") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (s === "superseded") return "bg-muted text-muted-foreground";
  return "bg-primary/10 text-primary";
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function truncate(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

export function ProposalsTab() {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "executed">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      const [threadsRes, pendingRes] = await Promise.all([
        fetch(`/api/org/tx-proposals${statusParam}`),
        fetch("/api/org/tx-proposals/pending"),
      ]);

      const threadsData = threadsRes.ok ? await threadsRes.json() : { threads: [] };
      setThreads(threadsData.threads ?? []);

      const pendingData = pendingRes.ok ? await pendingRes.json() : { pending: [] };
      setPending(pendingData.pending ?? []);
    } catch {
      setThreads([]);
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Transaction proposals</h2>
        <p className="text-xs text-muted-foreground max-w-2xl">
          Team-scoped discussions for pending multisig transactions. Start a discussion when your
          team needs to coordinate before signing — the record persists for audit after execution.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "open", "executed"] as const).map((f) => {
          const pendingBadge = f === "open" && pending.length > 0 ? pending.length : null;
          return (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium border transition-colors",
              statusFilter === f
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {f === "all" ? "All" : f === "open" ? "Open" : "Executed"}
            {pendingBadge != null && (
              <span
                className="inline-flex min-w-[1.125rem] h-[1.125rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground tabular-nums"
                aria-label={`${pendingBadge} pending without discussion`}
              >
                {pendingBadge > 9 ? "9+" : pendingBadge}
              </span>
            )}
          </button>
          );
        })}
      </div>

      {pending.length > 0 && statusFilter !== "executed" && (
        <section className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Pending without discussion
          </h3>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Safe</th>
                  <th className="text-left font-medium px-3 py-2">Type</th>
                  <th className="text-left font-medium px-3 py-2">Submitted</th>
                  <th className="text-right font-medium px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((tx) => (
                  <tr
                    key={`${tx.safeId}-${tx.safeTxHash}`}
                    className="border-t border-border/50 hover:bg-muted/20"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/safes/${tx.safeId}`}
                        className="text-primary hover:underline"
                      >
                        {tx.safeName ?? truncate(tx.safeAddress)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-foreground">{tx.txType}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {formatWhen(tx.submissionDate)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/dashboard/safes/${tx.safeId}/pending/${encodeURIComponent(tx.safeTxHash)}/discussion`}
                        className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                      >
                        <MessageSquarePlus className="h-3.5 w-3.5" />
                        Start discussion
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Discussion records
        </h3>
        {threads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 py-10 px-6 text-center">
            <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No discussion records yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              When a pending transaction needs team coordination, use &quot;Start discussion&quot; above.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Safe</th>
                  <th className="text-left font-medium px-3 py-2">Type</th>
                  <th className="text-left font-medium px-3 py-2">Team</th>
                  <th className="text-left font-medium px-3 py-2">Status</th>
                  <th className="text-left font-medium px-3 py-2">Comments</th>
                  <th className="text-left font-medium px-3 py-2">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {threads.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t border-border/50 hover:bg-muted/20 cursor-pointer"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/teams/proposals/${t.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {t.safeName ?? truncate(t.safeAddress)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {t.txSnapshot?.txType ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{t.teamName ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          statusClass(t.status)
                        )}
                      >
                        {TX_THREAD_STATUS_LABEL[t.status as keyof typeof TX_THREAD_STATUS_LABEL] ??
                          t.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {t.commentCount}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {formatWhen(t.lastActivityAt ?? t.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
