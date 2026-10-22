"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";

export interface BalanceItem {
  symbol: string;
  balance: string;
  decimals: number;
}

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
    return `< 0.001 ${symbol}`;
  } catch {
    return `— ${symbol}`;
  }
}

export function SafeBalance({
  safeId,
  initialBalances,
}: {
  safeId: string;
  initialBalances: BalanceItem[];
}) {
  const [balances, setBalances] = useState<BalanceItem[]>(initialBalances);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialBalances.length > 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/safes/${safeId}/balance`)
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(typeof data.error === "string" ? data.error : "Failed to load balance");
          return;
        }
        setBalances((data.balances ?? []) as BalanceItem[]);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load balance");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [safeId, initialBalances.length]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      )
        return;
      setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = prevOverflow;
    };
  }, [dropdownOpen]);

  if (loading) {
    return (
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        Loading…
      </span>
    );
  }
  if (error) {
    return <span className="text-muted-foreground">{error}</span>;
  }
  if (balances.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const ethBalance = balances.find((b) => b.symbol === "ETH");
  const otherBalances = balances.filter((b) => b.symbol !== "ETH");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-medium tabular-nums">
        {ethBalance
          ? formatBalance(ethBalance.balance, ethBalance.decimals, ethBalance.symbol)
          : "0 ETH"}
      </span>
      {otherBalances.length > 0 && (
        <>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => {
              if (!dropdownOpen) {
                setDropdownRect(triggerRef.current?.getBoundingClientRect() ?? null);
              }
              setDropdownOpen((o) => !o);
            }}
            className="inline-flex items-center gap-1 rounded border border-border bg-muted/30 px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
          >
            +{otherBalances.length} tokens
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>
          {dropdownOpen &&
            dropdownRect &&
            createPortal(
              <div
                ref={dropdownRef}
                role="listbox"
                className="fixed z-[100] flex min-w-[220px] max-h-[280px] flex-col rounded-lg border border-border bg-card shadow-lg"
                style={{
                  top: dropdownRect.bottom + 4,
                  left: dropdownRect.left,
                }}
              >
                <div className="shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
                  All token balances
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <ul className="space-y-0.5 px-2 py-1.5">
                    {otherBalances.map((b, i) => (
                      <li
                        key={i}
                        className="rounded px-2 py-1.5 text-sm font-medium tabular-nums hover:bg-muted/50"
                      >
                        {formatBalance(b.balance, b.decimals, b.symbol)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>,
              document.body
            )}
        </>
      )}
    </div>
  );
}
