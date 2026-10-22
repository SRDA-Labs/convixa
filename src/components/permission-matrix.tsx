"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  PERMISSION_MATRIX,
  PERMISSION_MATRIX_COLUMNS,
  toggleMatrixPermission,
  type MatrixColumnId,
} from "@/lib/permission-matrix";
import type { Permission } from "@/lib/permissions";

function MatrixInfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const tipId = useId();

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label="Permission details"
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && (
        <span
          id={tipId}
          role="tooltip"
          className="absolute left-1/2 bottom-full z-50 mb-1.5 w-44 -translate-x-1/2 rounded-md border border-border bg-card px-2 py-1.5 text-[10px] leading-snug text-foreground shadow-md"
        >
          {text}
        </span>
      )}
    </span>
  );
}

type PermissionMatrixProps = {
  selected: string[];
  onChange: (permissions: string[]) => void;
  /** Dark modal styling (create role dialog). */
  variant?: "default" | "modal";
  disabled?: boolean;
};

export function PermissionMatrix({
  selected,
  onChange,
  variant = "default",
  disabled = false,
}: PermissionMatrixProps) {
  const isModal = variant === "modal";

  function handleToggle(permission: Permission, checked: boolean) {
    if (disabled) return;
    onChange(toggleMatrixPermission(selected, permission, checked));
  }

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg border",
        isModal ? "border-zinc-800 bg-zinc-900/30" : "border-border bg-muted/10"
      )}
    >
      <table className="w-full min-w-[520px] text-left text-xs border-collapse">
        <thead>
          <tr className={cn("border-b", isModal ? "border-zinc-800" : "border-border")}>
            <th
              className={cn(
                "px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px] w-[38%]",
                isModal ? "text-zinc-500" : "text-muted-foreground"
              )}
            >
              Area
            </th>
            {PERMISSION_MATRIX_COLUMNS.map((col) => (
              <th
                key={col.id}
                className={cn(
                  "px-2 py-2.5 font-semibold uppercase tracking-wider text-[10px] text-center w-[15.5%]",
                  isModal ? "text-zinc-500" : "text-muted-foreground"
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_MATRIX.map((row, rowIdx) => (
            <tr
              key={row.id}
              className={cn(
                rowIdx < PERMISSION_MATRIX.length - 1 && "border-b",
                isModal ? "border-zinc-800/80" : "border-border/60"
              )}
            >
              <td
                className={cn(
                  "px-3 py-2.5 font-medium",
                  isModal ? "text-zinc-200" : "text-foreground"
                )}
              >
                {row.category}
              </td>
              {PERMISSION_MATRIX_COLUMNS.map((col) => {
                const cell = row.cells[col.id as MatrixColumnId];
                return (
                  <td key={col.id} className="px-2 py-2.5 text-center">
                    {cell ? (
                      <div className="inline-flex items-center justify-center gap-1">
                        <input
                          type="checkbox"
                          checked={selected.includes(cell.permission)}
                          disabled={disabled}
                          onChange={(e) => handleToggle(cell.permission, e.target.checked)}
                          className={cn(
                            "h-4 w-4 rounded border cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                            isModal
                              ? "border-zinc-600 bg-zinc-900 text-primary focus:ring-primary/50"
                              : "border-border text-primary focus:ring-primary/40"
                          )}
                          aria-label={`${row.category} — ${col.label}`}
                        />
                        <MatrixInfoTip text={cell.tooltip} />
                      </div>
                    ) : (
                      <span
                        className={cn(
                          "text-[10px]",
                          isModal ? "text-zinc-700" : "text-muted-foreground/40"
                        )}
                        aria-hidden
                      >
                        —
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
