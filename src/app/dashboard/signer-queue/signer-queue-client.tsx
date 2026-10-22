"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, Shield, ExternalLink, Loader2, Wallet, ClipboardCheck, X, MessageSquare } from "lucide-react";
import { PendingTxChecklistPanel } from "@/components/pending-tx-checklist-panel";
import { cn } from "@/lib/cn";
import { SAFE_CHAINS, getSafeAppUrl } from "@/lib/safe-api";
import { DEV_SIMULATED_SAFE_TX_HASH } from "@/lib/signer-queue/simulated-tx";

interface PendingTxItem {
  safeTxHash: string;
  to: string;
  value: string;
  type: string;
  txCategory: string;
  nonce: number;
  confirmations: number;
  confirmationsRequired: number;
  submissionDate: string;
  safeAppUrl: string;
  safeId: string | null;
  safeName: string | null;
  safeAddress: string;
  orgName: string;
  chainName: string;
}

interface QueueData {
  totalPending: number;
  awaitingCoSigners: number;
  pendingItems: PendingTxItem[];
  hasWallet: boolean;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function truncate(addr: string, start = 6, end = 4): string {
  if (addr.length <= start + end) return addr;
  return `${addr.slice(0, start)}…${addr.slice(-end)}`;
}

type TabId = "queue" | "safes";
type ReviewStatus = "in_progress" | "completed" | "signed";

function reviewKey(safeId: string, safeTxHash: string) {
  return `${safeId}:${safeTxHash.toLowerCase()}`;
}

function checklistButtonClass(status?: ReviewStatus, isOpen?: boolean): string {
  if (status === "completed" || status === "signed") {
    return "border-emerald-600/50 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15";
  }
  if (status === "in_progress") {
    return "border-amber-600/40 bg-amber-500/10 text-amber-800 hover:bg-amber-500/15";
  }
  return isOpen ? "bg-muted/50" : "";
}

export function SignerQueueClient() {
  const [queue, setQueue] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("queue");

  useEffect(() => {
    fetch("/api/signer/queue")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) {
          setQueue({ totalPending: 0, awaitingCoSigners: 0, pendingItems: [], hasWallet: false });
          setLoading(false);
          return;
        }
        const items: PendingTxItem[] = [];
        const hasWallet = (data.wallets ?? []).length > 0;
        for (const wallet of data.wallets ?? []) {
          for (const org of wallet.orgs ?? []) {
            for (const safe of org.safes ?? []) {
              for (const tx of safe.pendingTransactions ?? []) {
                if (tx.isWaitingOnMe === false) continue;
                items.push({
                  safeTxHash: tx.safeTxHash,
                  to: tx.to,
                  value: tx.value,
                  type: tx.type,
                  txCategory: tx.txCategory ?? tx.type,
                  nonce: tx.nonce ?? 0,
                  confirmations: tx.confirmations,
                  confirmationsRequired: tx.confirmationsRequired,
                  submissionDate: tx.submissionDate,
                  safeAppUrl: tx.safeAppUrl,
                  safeId: safe.safeId ?? null,
                  safeName: safe.safeName,
                  safeAddress: safe.safeAddress,
                  orgName: org.orgName,
                  chainName: safe.chainName,
                });
              }
            }
          }
        }
        setQueue({
          totalPending: data.totalPending ?? items.length,
          awaitingCoSigners: data.awaitingCoSigners ?? 0,
          pendingItems: items,
          hasWallet,
        });
        setLoading(false);
      })
      .catch(() => {
        setQueue({ totalPending: 0, awaitingCoSigners: 0, pendingItems: [], hasWallet: false });
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  const noWallet = !queue?.hasWallet;

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Signer Queue</h1>
          <p className="text-sm text-muted-foreground">
            Pending signatures and multisigs where your linked wallet is a signer
          </p>
        </div>
        {!noWallet && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">{queue?.totalPending ?? 0}</span> pending
            {queue && queue.pendingItems.length > 0 && (
              <> · needs your signature</>
            )}
          </p>
        )}
        <div
          role="tablist"
          aria-label="Signer queue sections"
          className="inline-flex flex-wrap gap-1 rounded-lg border border-border/60 bg-muted/30 p-1"
        >
          {(
            [
              { id: "queue" as const, label: "Pending", count: queue?.totalPending },
              { id: "safes" as const, label: "My multisigs", count: undefined },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0 text-[10px] font-semibold text-primary tabular-nums">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {noWallet ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 py-12 px-6 text-center">
          <Wallet className="h-10 w-10 text-muted-foreground/50" aria-hidden />
          <p className="mt-3 text-sm font-medium text-foreground">Link a wallet first</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Connect your wallet in settings to see multisigs you sign for and pending transactions waiting on you.
          </p>
          <Link
            href="/dashboard/settings/general"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            Link wallet in Settings
          </Link>
        </div>
      ) : activeTab === "queue" ? (
        <PendingQueueTab queue={queue} hasWallet={!noWallet} />
      ) : (
        <MyMultisigsTab />
      )}
    </div>
  );
}

function PendingQueueTab({
  queue,
  hasWallet,
}: {
  queue: QueueData | null;
  hasWallet: boolean;
}) {
  const [checklistModalKey, setChecklistModalKey] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<Record<string, ReviewStatus>>({});

  useEffect(() => {
    if (!checklistModalKey) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setChecklistModalKey(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [checklistModalKey]);

  useEffect(() => {
    fetch("/api/signer/checklist-reviews")
      .then((r) => (r.ok ? r.json() : { reviews: {} }))
      .then((data) => {
        const map: Record<string, ReviewStatus> = {};
        for (const [key, val] of Object.entries(
          (data.reviews ?? {}) as Record<string, { status: string }>
        )) {
          if (val.status === "completed" || val.status === "signed" || val.status === "in_progress") {
            map[key] = val.status;
          }
        }
        setReviewStatus(map);
      })
      .catch(() => {});
  }, []);

  if (!queue || queue.totalPending === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 py-12 px-6 text-center">
        <Bell className="h-9 w-9 text-muted-foreground/50" aria-hidden />
        <p className="mt-3 text-sm font-medium text-foreground">No pending signatures</p>
        {hasWallet && queue && queue.awaitingCoSigners > 0 ? (
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            You have{" "}
            <span className="font-medium text-foreground tabular-nums">{queue.awaitingCoSigners}</span>{" "}
            pending transaction{queue.awaitingCoSigners === 1 ? "" : "s"} on your multisigs where you
            have already signed. This queue only shows txs that still need{" "}
            <span className="font-medium text-foreground">your</span> signature — the Safe page lists
            all pending txs on a Safe.
          </p>
        ) : (
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Transactions that need your signature will appear here across multisigs where your linked
            wallet is a signer.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/80 bg-card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border/80 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5">Transaction</th>
              <th className="px-4 py-2.5">Safe</th>
              <th className="px-4 py-2.5 hidden sm:table-cell">Org</th>
              <th className="px-4 py-2.5">Sigs</th>
              <th className="px-4 py-2.5 hidden md:table-cell">Age</th>
              <th className="px-3 py-2.5 text-right min-w-[10.5rem]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {queue.pendingItems.map((tx) => {
              const rowKey = `${tx.safeId ?? tx.safeAddress}-${tx.safeTxHash}`;
              const isModalOpen = checklistModalKey === rowKey;
              const status =
                tx.safeId != null
                  ? reviewStatus[reviewKey(tx.safeId, tx.safeTxHash)]
                  : undefined;
              return (
                <tr key={tx.safeTxHash} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-foreground">
                      {tx.type}
                      {tx.safeTxHash === DEV_SIMULATED_SAFE_TX_HASH && (
                        <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          Simulated
                        </span>
                      )}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {truncate(tx.to, 8, 6)} · nonce {tx.nonce}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {tx.safeId ? (
                      <Link href={`/dashboard/safes/${tx.safeId}`} className="text-xs font-medium text-foreground hover:text-primary">
                        {tx.safeName ?? truncate(tx.safeAddress)}
                      </Link>
                    ) : (
                      <span className="text-xs text-foreground">{tx.safeName ?? truncate(tx.safeAddress)}</span>
                    )}
                    <p className="text-[10px] text-muted-foreground">{tx.chainName}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground">{tx.orgName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "text-xs font-medium tabular-nums",
                        tx.confirmations >= tx.confirmationsRequired ? "text-emerald-600" : "text-amber-600"
                      )}
                    >
                      {tx.confirmations}/{tx.confirmationsRequired}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground whitespace-nowrap">
                    {formatTime(tx.submissionDate)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {tx.safeId && (
                        <Link
                          href={`/dashboard/safes/${tx.safeId}/pending/${encodeURIComponent(tx.safeTxHash)}/discussion`}
                          className="inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-md border border-border px-2.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          title="Team discussion (team members only)"
                        >
                          <MessageSquare className="h-3 w-3 shrink-0" aria-hidden />
                          Discuss
                        </Link>
                      )}
                      {tx.safeId && (
                        <button
                          type="button"
                          onClick={() => setChecklistModalKey(rowKey)}
                          className={cn(
                            "inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-md border border-border px-2.5 text-[11px] font-medium hover:bg-muted/50",
                            checklistButtonClass(status, isModalOpen)
                          )}
                        >
                          <ClipboardCheck className="h-3 w-3 shrink-0" aria-hidden />
                          {status === "completed" || status === "signed" ? "Reviewed" : "Checklist"}
                        </button>
                      )}
                      <a
                        href={tx.safeAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Sign
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {checklistModalKey && (() => {
        const tx = queue.pendingItems.find(
          (t) => `${t.safeId ?? t.safeAddress}-${t.safeTxHash}` === checklistModalKey
        );
        if (!tx?.safeId) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setChecklistModalKey(null)}
            role="presentation"
          >
            <div
              className="w-full max-w-lg max-h-[min(90vh,640px)] flex flex-col rounded-xl border border-border bg-card shadow-lg"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="checklist-modal-title"
            >
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 shrink-0">
                <div className="min-w-0">
                  <h2
                    id="checklist-modal-title"
                    className="text-sm font-semibold flex items-center gap-1.5"
                  >
                    <ClipboardCheck className="h-4 w-4 text-primary shrink-0" />
                    Pre-sign checklist
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {tx.type}
                    {tx.safeName ? ` · ${tx.safeName}` : ` · ${truncate(tx.safeAddress)}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setChecklistModalKey(null)}
                  className="text-muted-foreground hover:text-foreground p-1 shrink-0"
                  aria-label="Close checklist"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="overflow-y-auto px-4 py-4">
                <PendingTxChecklistPanel
                  safeId={tx.safeId}
                  safeTxHash={tx.safeTxHash}
                  to={tx.to}
                  value={tx.value}
                  txCategory={tx.txCategory}
                  safeAppUrl={tx.safeAppUrl}
                  showCloseControl={false}
                  onClose={() => setChecklistModalKey(null)}
                  onSaved={({ status: nextStatus }) => {
                    setReviewStatus((prev) => ({
                      ...prev,
                      [reviewKey(tx.safeId!, tx.safeTxHash)]: nextStatus as ReviewStatus,
                    }));
                  }}
                />
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function MyMultisigsTab() {
  const [safes, setSafes] = useState<
    Array<{
      safeId: string | null;
      safeAddress: string;
      safeName: string | null;
      network: string;
      orgId: string | null;
      orgName: string | null;
      threshold: number;
      ownersCount: number;
      inInventory?: boolean;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/signer/safes")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setSafes(data?.safes ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-xs text-muted-foreground">Discovering multisigs across networks…</p>
      </div>
    );
  }

  if (safes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 py-12 px-6 text-center">
        <Shield className="h-9 w-9 text-muted-foreground/50" aria-hidden />
        <p className="mt-3 text-sm font-medium text-foreground">No multisigs found</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          We query the Safe Transaction Service for safes where your linked wallet is a signer.
          If you expect results, confirm the wallet is linked in Settings and try again in a minute
          (discovery scans all supported chains).
        </p>
        <Link
          href="/dashboard/settings/general"
          className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
        >
          Wallet settings
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/80 bg-card overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border/80 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5">Safe</th>
            <th className="px-4 py-2.5">Network</th>
            <th className="px-4 py-2.5 hidden sm:table-cell">Org</th>
            <th className="px-4 py-2.5">Threshold</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {safes.map((s) => {
            const networkLabel = SAFE_CHAINS.find((c) => c.slug === s.network)?.name ?? s.network;
            const safeAppUrl = getSafeAppUrl(s.network, s.safeAddress);
            const rowKey = s.safeId ?? `${s.safeAddress}:${s.network}`;
            return (
              <tr key={rowKey} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  {s.safeId ? (
                    <Link
                      href={`/dashboard/safes/${s.safeId}`}
                      className="text-xs font-medium text-foreground hover:text-primary"
                    >
                      {s.safeName ?? truncate(s.safeAddress, 8, 6)}
                    </Link>
                  ) : (
                    <a
                      href={safeAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary"
                    >
                      {truncate(s.safeAddress, 8, 6)}
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  )}
                  <p className="font-mono text-[10px] text-muted-foreground">{truncate(s.safeAddress)}</p>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{networkLabel}</td>
                <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground">
                  {s.orgName ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs font-medium tabular-nums">
                  {s.threshold}/{s.ownersCount}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
