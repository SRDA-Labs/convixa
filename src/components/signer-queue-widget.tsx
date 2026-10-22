"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PendingTx } from "@/lib/signer-queue/aggregator";

interface QueueSummary {
  totalPending: number;
  topItems: Array<{
    safeTxHash: string;
    type: string;
    to: string;
    safeName: string | null;
    safeAddress: string;
    orgName: string;
    chainName: string;
    confirmations: number;
    confirmationsRequired: number;
    safeAppUrl: string;
  }>;
  orgCount: number;
  safeCount: number;
}

function truncate(str: string, start = 8, end = 6): string {
  if (str.length <= start + end) return str;
  return `${str.slice(0, start)}…${str.slice(-end)}`;
}

export function SignerQueueWidget() {
  const [data, setData] = useState<QueueSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/signer/queue")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json) return;

        const topItems: QueueSummary["topItems"] = [];
        let orgSet = new Set<string>();
        let safeSet = new Set<string>();

        for (const wallet of json.wallets ?? []) {
          for (const org of wallet.orgs ?? []) {
            orgSet.add(org.orgId);
            for (const safe of org.safes ?? []) {
              safeSet.add(safe.safeId);
              for (const tx of safe.pendingTransactions ?? []) {
                if (topItems.length < 5) {
                  topItems.push({
                    safeTxHash: tx.safeTxHash,
                    type: tx.type,
                    to: tx.to,
                    safeName: safe.safeName,
                    safeAddress: safe.safeAddress,
                    orgName: org.orgName,
                    chainName: safe.chainName,
                    confirmations: tx.confirmations,
                    confirmationsRequired: tx.confirmationsRequired,
                    safeAppUrl: tx.safeAppUrl,
                  });
                }
              }
            }
          }
        }

        setData({
          totalPending: json.totalPending ?? 0,
          topItems,
          orgCount: orgSet.size,
          safeCount: safeSet.size,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-center min-h-[140px]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.totalPending === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center">
        <Bell className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No pending signatures</p>
        <p className="text-xs text-muted-foreground mt-1">
          Your queue is empty.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground">My Queue</h3>
          </div>
          <Link
            href="/dashboard/signer-queue"
            className="text-xs font-medium text-primary hover:underline shrink-0"
          >
            View all →
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          <span className="font-semibold text-foreground">{data.totalPending} transaction{data.totalPending !== 1 ? "s" : ""}</span> waiting
          {" "}across {data.orgCount} org{data.orgCount !== 1 ? "s" : ""}, {data.safeCount} Safe{data.safeCount !== 1 ? "s" : ""}
        </p>
      </div>

      <ul className="divide-y divide-border">
        {data.topItems.slice(0, 3).map((item) => (
          <li key={item.safeTxHash} className="px-5 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.type}: {truncate(item.to)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.safeName ?? truncate(item.safeAddress, 6, 4)} · {item.orgName} · {item.chainName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.confirmations}/{item.confirmationsRequired} confirmed
                </p>
              </div>
              <a
                href={item.safeAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0 mt-1"
              >
                Sign <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </li>
        ))}
      </ul>

      {data.topItems.length > 3 && (
        <div className="px-5 py-2.5 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            +{data.topItems.length - 3} more pending
          </p>
        </div>
      )}
    </div>
  );
}
