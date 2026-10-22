"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SAFE_CHAINS } from "@/lib/safe-api";
import { ThresholdCell } from "./threshold-cell";
import { Copy, ChevronRight } from "lucide-react";

const MAX_SAFES_FOR_BALANCE = 25;

function formatBalance(balance: string, decimals: number, symbol: string): string {
  try {
    const n = BigInt(balance);
    if (n === BigInt(0)) return `0 ${symbol}`;
    const divisor = 10 ** decimals;
    const whole = n / BigInt(divisor);
    const frac = n % BigInt(divisor);
    const fracStr = frac.toString().padStart(decimals, "0").slice(0, decimals).replace(/0+$/, "") || "0";
    const fracTrim = fracStr.slice(0, 4);
    if (whole > BigInt(0)) {
      return `${whole}${fracTrim !== "0" ? "." + fracTrim : ""} ${symbol}`;
    }
    return "< 0.001";
  } catch {
    return "—";
  }
}

function truncate(str: string, start = 6, end = 4): string {
  if (str.length <= start + end) return str;
  return `${str.slice(0, start)}…${str.slice(-end)}`;
}

function parseOwners(v: string | null | undefined): string[] {
  if (v == null) return [];
  if (typeof v === "string") try { return JSON.parse(v); } catch { return []; }
  return Array.isArray(v) ? v : [];
}

export type SafeRow = {
  id: string;
  address: string;
  network: string;
  name: string | null;
  teamId: string;
  teamName: string;
  threshold: number | null;
  owners: string | null;
  pendingCount: number | null;
  refreshedAt: string | null;
  complianceWarn?: number;
  complianceFail?: number;
};

export function InventoryTable({
  safesList,
  showTeamColumn = true,
}: {
  safesList: SafeRow[];
  showTeamColumn?: boolean;
}) {
  const [balanceBySafeId, setBalanceBySafeId] = useState<
    Map<string, { symbol: string; balance: string; decimals: number }>
  >(new Map());
  const [pendingCountBySafeId, setPendingCountBySafeId] = useState<Map<string, number>>(new Map());

  const idsKey = safesList
    .slice(0, MAX_SAFES_FOR_BALANCE)
    .map((s) => s.id)
    .join(",");
  useEffect(() => {
    if (!idsKey) return;
    fetch(`/api/safes/balances?ids=${encodeURIComponent(idsKey)}`)
      .then((res) => res.json())
      .then((data: Record<string, { symbol: string; balance: string; decimals: number } | null>) => {
        const map = new Map<string, { symbol: string; balance: string; decimals: number }>();
        for (const [id, bal] of Object.entries(data)) {
          if (bal) map.set(id, bal);
        }
        setBalanceBySafeId(map);
      })
      .catch(() => {});
  }, [idsKey]);

  useEffect(() => {
    if (!idsKey) return;
    fetch(`/api/safes/pending-counts?ids=${encodeURIComponent(idsKey)}`)
      .then((res) => res.json())
      .then((data: Record<string, number>) => {
        const map = new Map<string, number>();
        for (const [id, count] of Object.entries(data)) {
          if (typeof count === "number") map.set(id, count);
        }
        setPendingCountBySafeId(map);
      })
      .catch(() => {});
  }, [idsKey]);

  const copyAddress = useCallback((address: string) => {
    void navigator.clipboard.writeText(address);
  }, []);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border/80 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Safe</th>
            <th className="px-4 py-2.5 font-medium">SEAL</th>
            <th className="px-4 py-2.5 font-medium">Threshold</th>
            <th className="px-4 py-2.5 font-medium">Network</th>
            <th className="px-4 py-2.5 font-medium">Balance</th>
            <th className="px-4 py-2.5 font-medium text-center">Pending</th>
            {showTeamColumn && <th className="px-4 py-2.5 font-medium">Team</th>}
            <th className="w-8 px-2 py-2.5" aria-hidden />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {safesList.map((s) => {
            const signers = parseOwners(s.owners);
            const bal = balanceBySafeId.get(s.id);
            const livePending = pendingCountBySafeId.get(s.id);
            const pendingCount = livePending !== undefined ? livePending : (s.pendingCount ?? null);
            const networkLabel = SAFE_CHAINS.find((c) => c.slug === s.network)?.name ?? s.network;
            return (
              <tr key={s.id} className="group hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/safes/${s.id}`}
                      className="font-medium text-foreground hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded-sm"
                    >
                      {s.name || truncate(s.address, 8, 6)}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-1">
                      <span className="font-mono text-[11px] text-muted-foreground" title={s.address}>
                        {truncate(s.address, 8, 6)}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyAddress(s.address)}
                        className="text-muted-foreground/70 hover:text-foreground p-0.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                        aria-label="Copy address"
                      >
                        <Copy className="h-3 w-3" aria-hidden />
                      </button>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {(s.complianceFail ?? 0) > 0 || (s.complianceWarn ?? 0) > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {(s.complianceFail ?? 0) > 0 && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                          {s.complianceFail} fail
                        </span>
                      )}
                      {(s.complianceWarn ?? 0) > 0 && (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          {s.complianceWarn} warn
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                      OK
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ThresholdCell threshold={s.threshold} signers={signers} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{networkLabel}</td>
                <td className="px-4 py-3 text-xs font-medium tabular-nums whitespace-nowrap">
                  {bal ? formatBalance(bal.balance, bal.decimals, bal.symbol) : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  {pendingCount != null && pendingCount > 0 ? (
                    <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary tabular-nums">
                      {pendingCount}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50 text-xs">—</span>
                  )}
                </td>
                {showTeamColumn && (
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{s.teamName}</td>
                )}
                <td className="px-2 py-3 text-muted-foreground/40 group-hover:text-muted-foreground">
                  <Link
                    href={`/dashboard/safes/${s.id}`}
                    className="inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded"
                    aria-label={`View ${s.name || s.address}`}
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
