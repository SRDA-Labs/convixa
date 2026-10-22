"use client";

import { cn } from "@/lib/cn";
import { networkLabel } from "@/lib/safe-propose/owner-change";
import type { ProposeSafeOption } from "../types";

function truncate(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function SelectSafesStep({
  eligible,
  selectedIds,
  onToggle,
  onSelectAllEligible,
}: {
  eligible: { safe: ProposeSafeOption; reason: string | null }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectAllEligible: () => void;
}) {
  const eligibleCount = eligible.filter((e) => !e.reason).length;

  if (eligible.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No Safes in inventory. Add Safes first, then return here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Select which inventory multisigs should receive this proposal.
        </p>
        {eligibleCount > 0 && (
          <button
            type="button"
            onClick={onSelectAllEligible}
            className="shrink-0 text-xs font-medium text-primary hover:underline"
          >
            Select all eligible ({eligibleCount})
          </button>
        )}
      </div>
      <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/60">
        {eligible.map(({ safe, reason }) => {
          const disabled = Boolean(reason);
          const checked = selectedIds.includes(safe.id);
          const label = safe.name?.trim() || truncate(safe.address);
          return (
            <li key={safe.id}>
              <label
                className={cn(
                  "flex items-start gap-3 px-3 py-2.5 text-sm",
                  disabled
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:bg-muted/30"
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  disabled={disabled}
                  checked={checked && !disabled}
                  onChange={() => onToggle(safe.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">{label}</span>
                  <span className="block font-mono text-[11px] text-muted-foreground">
                    {truncate(safe.address)} · {networkLabel(safe.network)}
                    {safe.threshold != null ? ` · ${safe.threshold}/${safe.owners.length}` : ""}
                  </span>
                  {reason && (
                    <span className="mt-0.5 block text-[11px] text-amber-700 dark:text-amber-400">
                      {reason}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
