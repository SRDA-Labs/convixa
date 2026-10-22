"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

function truncate(str: string, start = 6, end = 4): string {
  if (str.length <= start + end) return str;
  return `${str.slice(0, start)}…${str.slice(-end)}`;
}

export function ThresholdCell({
  threshold,
  signers,
}: {
  threshold: number | null;
  signers: string[];
}) {
  const [open, setOpen] = useState(false);
  const [popoverRect, setPopoverRect] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePosition = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setPopoverRect({
      top: rect.bottom + 4,
      left: rect.left,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleOpen = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    setOpen(true);
    updatePosition();
  };

  const handleButtonLeave = () => {
    leaveTimeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  const handlePopoverEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    setOpen(true);
  };

  const label =
    threshold != null && signers.length > 0
      ? `${threshold} of ${signers.length}`
      : "—";

  const popoverContent =
    open &&
    signers.length > 0 &&
    typeof document !== "undefined" &&
    popoverRect &&
    createPortal(
      <div
        className="fixed z-[200] min-w-[240px] max-w-[320px] rounded-lg border border-border bg-card py-2 shadow-xl"
        style={{
          top: popoverRect.top,
          left: popoverRect.left,
        }}
        role="tooltip"
        onMouseEnter={handlePopoverEnter}
        onMouseLeave={() => setOpen(false)}
      >
        <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Signers ({signers.length})
        </p>
        <ul className="max-h-64 overflow-y-auto px-3 py-1">
          {signers.map((addr) => (
            <li
              key={addr}
              className="font-mono text-xs text-foreground py-1.5 break-all"
              title={addr}
            >
              {truncate(addr, 10, 8)}
            </li>
          ))}
        </ul>
      </div>,
      document.body
    );

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onMouseEnter={handleOpen}
        onMouseLeave={handleButtonLeave}
        onClick={() => {
          setOpen((v) => !v);
          updatePosition();
        }}
        className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium tabular-nums text-foreground hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
        title={signers.length > 0 ? "View signers" : undefined}
      >
        {label}
      </button>
      {popoverContent}
    </div>
  );
}
