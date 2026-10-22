"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Copy, ExternalLink, Loader2, MessageSquare } from "lucide-react";
import { getExplorerTxUrl, SAFE_CHAINS } from "@/lib/safe-api";
import { cn } from "@/lib/cn";
import type { InventoryTxRow, InventoryTxStatus } from "@/lib/inventory/types";

type Meta = {
  safeCount: number;
  totalSafes: number;
  truncated: boolean;
  partialErrors: number;
};

type StatusFilter = InventoryTxStatus | "all";

type Props = {
  initialTransactions: InventoryTxRow[];
  initialNextCursor: string | null;
  initialMeta: Meta;
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "proposed", label: "Proposed" },
  { value: "executed", label: "Executed" },
  { value: "cancelled", label: "Cancelled" },
];

function parseStatusParam(raw: string | null): StatusFilter {
  if (raw === "proposed" || raw === "executed" || raw === "cancelled") return raw;
  return "all";
}
function truncate(str: string, start = 6, end = 4): string {
  if (str.length <= start + end) return str;
  return `${str.slice(0, start)}…${str.slice(-end)}`;
}

function formatValue(wei: string): string {
  try {
    const n = BigInt(wei);
    if (n === BigInt(0)) return "0";
    const eth = Number(n) / 1e18;
    if (eth >= 1) return `${eth.toFixed(2)} ETH`;
    if (eth >= 0.001) return `${eth.toFixed(4)} ETH`;
    return "< 0.001 ETH";
  } catch {
    return wei;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function networkLabel(slug: string): string {
  return SAFE_CHAINS.find((c) => c.slug === slug)?.name ?? slug;
}

function statusBadge(status: InventoryTxStatus): { label: string; className: string } {
  switch (status) {
    case "executed":
      return {
        label: "Executed",
        className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
      };
    case "proposed":
      return {
        label: "Proposed",
        className: "bg-amber-500/15 text-amber-800 dark:text-amber-400",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-muted text-muted-foreground",
      };
  }
}

export function TransactionsFeedClient({
  initialTransactions,
  initialNextCursor,
  initialMeta,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const teamId = searchParams.get("teamId");
  const urlStatus = parseStatusParam(searchParams.get("status"));

  // Local selection updates immediately; URL/SSR catch up separately.
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>(urlStatus);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [meta, setMeta] = useState(initialMeta);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchGenRef = useRef(0);

  // Team-filter Link navigations remount SSR props — sync table + chip from server.
  useEffect(() => {
    setSelectedStatus(urlStatus);
    setTransactions(initialTransactions);
    setNextCursor(initialNextCursor);
    setMeta(initialMeta);
    setLoadError(null);
    setFilterLoading(false);
  }, [initialTransactions, initialNextCursor, initialMeta, urlStatus, teamId]);

  const replaceStatusInUrl = useCallback(
    (status: StatusFilter) => {
      const params = new URLSearchParams(searchParams.toString());
      if (status === "all") params.delete("status");
      else params.set("status", status);
      const qs = params.toString();
      // Avoid router.push — that re-runs the expensive RSC aggregate before the chip can update.
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, searchParams]
  );

  const setStatus = useCallback(
    async (status: StatusFilter) => {
      if (status === selectedStatus && !filterLoading) return;
      setSelectedStatus(status);
      replaceStatusInUrl(status);
      setLoadError(null);
      setFilterLoading(true);
      const gen = ++fetchGenRef.current;
      try {
        const params = new URLSearchParams();
        params.set("limit", "50");
        if (status !== "all") params.set("status", status);
        if (teamId) params.set("teamId", teamId);
        const res = await fetch(`/api/inventory/transactions?${params.toString()}`);
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Failed to load (${res.status})`);
        }
        const data = (await res.json()) as {
          transactions: InventoryTxRow[];
          nextCursor: string | null;
          meta: Meta;
        };
        if (gen !== fetchGenRef.current) return;
        setTransactions(data.transactions);
        setNextCursor(data.nextCursor);
        setMeta(data.meta);
      } catch (err) {
        if (gen !== fetchGenRef.current) return;
        setLoadError(err instanceof Error ? err.message : "Failed to filter transactions");
      } finally {
        if (gen === fetchGenRef.current) setFilterLoading(false);
      }
    },
    [filterLoading, replaceStatusInUrl, selectedStatus, teamId]
  );

  const copyHash = useCallback((hash: string) => {
    void navigator.clipboard.writeText(hash);
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || filterLoading) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      params.set("cursor", nextCursor);
      params.set("limit", "50");
      if (selectedStatus !== "all") params.set("status", selectedStatus);
      if (teamId) params.set("teamId", teamId);
      const res = await fetch(`/api/inventory/transactions?${params.toString()}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to load (${res.status})`);
      }
      const data = (await res.json()) as {
        transactions: InventoryTxRow[];
        nextCursor: string | null;
        meta: Meta;
      };
      setTransactions((prev) => {
        const seen = new Set(prev.map((t) => `${t.safeId}:${t.safeTxHash}`));
        const merged = [...prev];
        for (const row of data.transactions) {
          const key = `${row.safeId}:${row.safeTxHash}`;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(row);
          }
        }
        return merged;
      });
      setNextCursor(data.nextCursor);
      setMeta(data.meta);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }, [filterLoading, loadingMore, nextCursor, selectedStatus, teamId]);

  return (
    <div className="space-y-4">
      <div
        className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-1"
        role="group"
        aria-label="Filter by status"
      >
        {STATUS_FILTERS.map((f) => {
          const active = selectedStatus === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => void setStatus(f.value)}
              aria-pressed={active}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          );
        })}
        {filterLoading && (
          <Loader2
            className="ml-1 h-3.5 w-3.5 animate-spin text-muted-foreground"
            aria-label="Loading filter"
          />
        )}
      </div>

      {meta.truncated && (
        <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Showing activity from the first {meta.safeCount} of {meta.totalSafes} Safes
          (limit for live aggregation).
        </p>
      )}

      {meta.partialErrors > 0 && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          Could not load transactions for {meta.partialErrors} Safe
          {meta.partialErrors === 1 ? "" : "s"} (rate limit or network error). Other results are shown.
        </p>
      )}

      {transactions.length === 0 && !filterLoading ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 py-12 px-6 text-center">
          <h2 className="text-base font-medium text-foreground">No transactions</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Latest proposed, executed, and cancelled multisig transactions across your inventory will
            appear here.
          </p>
        </div>
      ) : transactions.length === 0 && filterLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : (
        <div
          className={cn(
            "overflow-x-auto rounded-lg border border-border/60 transition-opacity",
            filterLoading && "opacity-60"
          )}
        >          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Txn hash</th>
                <th className="px-4 py-2.5 font-medium">Msig</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Network</th>
                <th className="px-4 py-2.5 font-medium text-right">Value</th>
                <th className="w-20 px-2 py-2.5" aria-hidden />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {transactions.map((tx) => {
                const badge = statusBadge(tx.status);
                const msigLabel = tx.safeName?.trim() || truncate(tx.safeAddress);
                const explorerUrl = tx.transactionHash
                  ? getExplorerTxUrl(tx.network, tx.transactionHash)
                  : null;
                const discussionHref =
                  tx.status === "proposed"
                    ? `/dashboard/safes/${tx.safeId}/pending/${encodeURIComponent(tx.safeTxHash)}/discussion`
                    : null;

                return (
                  <tr
                    key={`${tx.safeId}:${tx.safeTxHash}`}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <span title={tx.safeTxHash}>{truncate(tx.safeTxHash, 8, 6)}</span>
                        <button
                          type="button"
                          onClick={() => copyHash(tx.safeTxHash)}
                          className="rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                          aria-label="Copy Safe transaction hash"
                        >
                          <Copy className="h-3 w-3" aria-hidden />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/dashboard/safes/${tx.safeId}`}
                        className="font-medium text-foreground hover:text-primary hover:underline underline-offset-2"
                      >
                        {msigLabel}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium",
                          badge.className
                        )}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums text-xs">
                      {formatDate(tx.sortAt)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{tx.txType}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {networkLabel(tx.network)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                      {formatValue(tx.value)}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {discussionHref && (
                          <Link
                            href={discussionHref}
                            title="Discuss"
                            className="rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                            aria-label="Open discussion"
                          >
                            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                          </Link>
                        )}
                        {explorerUrl && (
                          <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View on explorer"
                            className="rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                            aria-label="View on block explorer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {loadError && (
        <p className="text-xs text-destructive" role="alert">
          {loadError}
        </p>
      )}

      {nextCursor && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-60"
          >
            {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
