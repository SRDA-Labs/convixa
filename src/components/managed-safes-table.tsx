"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { SAFE_CHAINS } from "@/lib/safe-api";
import { ThresholdCell } from "@/app/dashboard/inventory/threshold-cell";
import { staggerContainer, staggerItem } from "@/lib/transitions";

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

function safeInitial(name: string | null, address: string): string {
  if (name && name.length >= 2) return name.slice(0, 2).toUpperCase();
  if (address.length >= 2) return address.slice(2, 4).toUpperCase();
  return "??";
}

/** Network badge — monochrome, saving color for actual signal. */
const NETWORK_BADGE_CLASS = "bg-border-subtle text-muted-foreground";

export type ManagedSafeRow = {
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
};

export function ManagedSafesTable({ safesList }: { safesList: ManagedSafeRow[] }) {
  const [balanceBySafeId, setBalanceBySafeId] = useState<
    Map<string, { symbol: string; balance: string; decimals: number }>
  >(new Map());
  const [pendingCountBySafeId, setPendingCountBySafeId] = useState<Map<string, number>>(new Map());
  const shouldReduceMotion = useReducedMotion();

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

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold border-b border-border bg-white/5 dark:bg-white/5">
              <th className="px-6 py-3">Safe Name</th>
              <th className="px-6 py-3">Network</th>
              <th className="px-6 py-3 text-right">Balance</th>
              <th className="px-6 py-3 text-right">Threshold</th>
              <th className="px-6 py-3 text-right">Pending Actions</th>
            </tr>
          </thead>
          <motion.tbody
            className="divide-y divide-border"
            variants={staggerContainer}
            initial="hidden"
            animate={shouldReduceMotion ? "visible" : "visible"}
          >
            {safesList.map((s) => {
              const signers = parseOwners(s.owners);
              const bal = balanceBySafeId.get(s.id);
              const livePending = pendingCountBySafeId.get(s.id);
              const pendingCount = livePending !== undefined ? livePending : (s.pendingCount ?? null);
              const networkLabel = SAFE_CHAINS.find((c) => c.slug === s.network)?.name ?? s.network;
              const initial = safeInitial(s.name, s.address);
              const networkBadgeClass = NETWORK_BADGE_CLASS;
              return (
                <motion.tr
                  key={s.id}
                  variants={shouldReduceMotion ? undefined : staggerItem}
                  className="hover:bg-white/5 dark:hover:bg-white/5 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/dashboard/safes/${s.id}`}
                      className="flex items-center gap-3 text-foreground hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 rounded min-w-0"
                    >
                      <span
                        className="size-8 rounded bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0"
                        aria-hidden
                      >
                        {initial}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{s.name || truncate(s.address, 8, 6)}</p>
                        <p className="text-[10px] text-muted-foreground font-mono" title={s.address}>
                          {truncate(s.address, 6, 4)}
                        </p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`size-4 rounded-full flex items-center justify-center text-[8px] font-medium ${networkBadgeClass}`}
                        aria-hidden
                      >
                        {networkLabel.charAt(0)}
                      </span>
                      <span className="text-xs">{networkLabel}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-bold tabular-nums text-foreground">
                    {bal ? formatBalance(bal.balance, bal.decimals, bal.symbol) : "—"}
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-muted-foreground">
                    <ThresholdCell threshold={s.threshold} signers={signers} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    {pendingCount != null && pendingCount > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-primary tabular-nums">
                        {pendingCount}
                      </span>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </motion.tbody>
        </table>
      </div>
    </div>
  );
}
