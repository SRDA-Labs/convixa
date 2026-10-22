"use client";

import { useState, useEffect, useMemo } from "react";
import { ExternalLink, Loader2, ArrowUpDown, ArrowDown, ArrowUp } from "lucide-react";
import { getExplorerTxUrl } from "@/lib/safe-api";

type ValueSort = "desc" | "asc" | null;

export interface SafeTxItem {
  safeTxHash: string;
  transactionHash: string | null;
  to: string;
  value: string;
  submissionDate: string;
  executedAt: string | null;
  txType: string;
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
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  return d.toLocaleString("en-US", { month: "short", day: "numeric" });
}

function truncate(str: string, start = 6, end = 4): string {
  if (str.length <= start + end) return str;
  return `${str.slice(0, start)}…${str.slice(-end)}`;
}

export function SafeTransactions({
  safeId,
  network,
  initialTransactions,
}: {
  safeId: string;
  network: string;
  initialTransactions: SafeTxItem[];
}) {
  const [transactions, setTransactions] = useState<SafeTxItem[]>(initialTransactions);
  const [hasMore, setHasMore] = useState(initialTransactions.length === 10);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [valueSort, setValueSort] = useState<ValueSort>(null);

  const sortedTransactions = useMemo(() => {
    if (valueSort === null) return transactions;
    return [...transactions].sort((a, b) => {
      const valA = BigInt(a.value);
      const valB = BigInt(b.value);
      if (valA < valB) return valueSort === "asc" ? -1 : 1;
      if (valA > valB) return valueSort === "asc" ? 1 : -1;
      return 0;
    });
  }, [transactions, valueSort]);

  function cycleValueSort() {
    setValueSort((prev) => (prev === null ? "desc" : prev === "desc" ? "asc" : null));
  }

  // If server didn't pass any transactions, fetch first page on mount (client-side request to Safe API via our API)
  useEffect(() => {
    if (initialTransactions.length > 0) return;
    let cancelled = false;
    setLoadingInitial(true);
    setError(null);
    fetch(`/api/safes/${safeId}/transactions?limit=10&offset=0`)
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (cancelled) return;
        if (!data.transactions && data.error) {
          setError(typeof data.error === "string" ? data.error : "Failed to load transaction history");
          return;
        }
        const list = (data.transactions ?? []) as SafeTxItem[];
        setTransactions(list);
        setHasMore(data.hasMore === true);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load transaction history");
      })
      .finally(() => {
        if (!cancelled) setLoadingInitial(false);
      });
    return () => {
      cancelled = true;
    };
  }, [safeId, initialTransactions.length]);

  async function fetchMore() {
    setError(null);
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/safes/${safeId}/transactions?limit=10&offset=${transactions.length}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) || "Failed to load more");
        return;
      }
      const list = (data.transactions ?? []) as SafeTxItem[];
      setHasMore(data.hasMore === true);
      setTransactions((prev) => [...prev, ...list]);
    } catch {
      setError("Network error");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden card-glow">
      <div className="border-b border-border bg-muted/30 px-5 py-3">
        <h2 className="font-semibold text-foreground">Transaction history</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Executed multisig transactions (most recent first)
        </p>
      </div>
      <div className="p-5 flex flex-col">
        {loadingInitial ? (
          <div className="min-h-[200px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground text-center inline-flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading transaction history…
            </p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="min-h-[200px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground text-center">
              {error || "No executed transactions yet."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-auto -mx-1 min-h-[200px] max-h-[200px]" style={{ height: "200px" }}>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="font-medium py-2 px-2 w-8 text-center text-xs">#</th>
                    <th className="font-medium py-2 px-2 w-[85px] text-xs">Date</th>
                    <th className="font-medium py-2 px-2 text-xs">Type</th>
                    <th className="font-medium py-2 px-2 text-xs">To</th>
                    <th className="font-medium py-2 px-2 text-right text-xs">
                      <button
                        type="button"
                        onClick={cycleValueSort}
                        className="inline-flex items-center gap-1 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded"
                        title={valueSort === "desc" ? "Highest first" : valueSort === "asc" ? "Lowest first" : "Sort by value"}
                      >
                        Value
                        {valueSort === "desc" && <ArrowDown className="h-3 w-3" />}
                        {valueSort === "asc" && <ArrowUp className="h-3 w-3" />}
                        {valueSort === null && <ArrowUpDown className="h-3 w-3 opacity-60" />}
                      </button>
                    </th>
                    <th className="font-medium py-2 px-2 w-16 text-right text-xs">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTransactions.map((tx, index) => {
                    const explorerUrl = tx.transactionHash
                      ? getExplorerTxUrl(network, tx.transactionHash)
                      : null;
                    const dateStr = tx.executedAt
                      ? formatDate(tx.executedAt)
                      : formatDate(tx.submissionDate);
                    return (
                      <tr
                        key={tx.safeTxHash}
                        className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                      >
                        <td className="py-1.5 px-2 text-center text-muted-foreground tabular-nums">
                          {index + 1}
                        </td>
                        <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">
                          {dateStr}
                        </td>
                        <td className="py-1.5 px-2 text-foreground">
                          {tx.txType}
                        </td>
                        <td className="py-1.5 px-2 font-mono text-xs truncate max-w-[140px]" title={tx.to}>
                          {truncate(tx.to, 8, 6)}
                        </td>
                        <td className="py-1.5 px-2 text-right font-medium tabular-nums">
                          {formatValue(tx.value)}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {explorerUrl ? (
                            <a
                              href={explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-medium"
                              title="View on block explorer"
                            >
                              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                              View
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs" title={tx.safeTxHash}>
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {error && (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            )}
            {hasMore && (
              <div className="mt-4 flex justify-center shrink-0">
                <button
                  type="button"
                  onClick={fetchMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    "Fetch more"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
