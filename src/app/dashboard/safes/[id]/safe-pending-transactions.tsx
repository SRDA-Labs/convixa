"use client";

import Link from "next/link";
import { ExternalLink, MessageSquare } from "lucide-react";

export interface PendingTxItem {
  safeTxHash: string;
  to: string;
  value: string;
  submissionDate: string;
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

export function SafePendingTransactions({
  safeId,
  pendingTransactions,
  queueUrl,
}: {
  safeId: string;
  pendingTransactions: PendingTxItem[];
  queueUrl: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden card-glow" data-section="pending-transactions">
      <div className="border-b border-border bg-muted/30 px-5 py-3">
        <h2 id="pending-transactions-heading" className="font-semibold text-foreground">Pending transactions</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Queued multisig transactions (view and sign on Safe)
        </p>
      </div>
      <div className="p-5">
        {pendingTransactions.length === 0 ? (
          <div className="min-h-[200px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground text-center">
              No pending transactions in the queue.
            </p>
          </div>
        ) : (
          <div className="overflow-auto -mx-1 min-h-[200px] max-h-[200px]" style={{ height: "200px" }}>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="font-medium py-2 px-2 w-8 text-center text-xs">#</th>
                  <th className="font-medium py-2 px-2 w-[85px] text-xs">Date</th>
                  <th className="font-medium py-2 px-2 text-xs">Type</th>
                  <th className="font-medium py-2 px-2 text-xs">To</th>
                  <th className="font-medium py-2 px-2 text-right text-xs">Value</th>
                  <th className="font-medium py-2 px-2 w-24 text-right text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingTransactions.map((tx, index) => (
                  <tr
                    key={tx.safeTxHash}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    <td className="py-1.5 px-2 text-center text-muted-foreground tabular-nums">
                      {index + 1}
                    </td>
                    <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">
                      {formatDate(tx.submissionDate)}
                    </td>
                    <td className="py-1.5 px-2 text-foreground">{tx.txType}</td>
                    <td
                      className="py-1.5 px-2 font-mono text-xs truncate max-w-[140px]"
                      title={tx.to}
                    >
                      {truncate(tx.to, 8, 6)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-medium tabular-nums">
                      {formatValue(tx.value)}
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/safes/${safeId}/pending/${encodeURIComponent(tx.safeTxHash)}/discussion`}
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary text-xs font-medium"
                          title="Team discussion"
                        >
                          <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                          Discuss
                        </Link>
                        <a
                          href={queueUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-medium"
                          title="View queue on Safe"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          Safe
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
