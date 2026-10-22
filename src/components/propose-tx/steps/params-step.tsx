"use client";

import type { ProposeTemplate } from "../types";

export function ParamsStep({
  template,
  primaryAddress,
  secondaryAddress,
  threshold,
  onChange,
  error,
}: {
  template: ProposeTemplate;
  primaryAddress: string;
  secondaryAddress: string;
  threshold: string;
  onChange: (patch: {
    primaryAddress?: string;
    secondaryAddress?: string;
    threshold?: string;
  }) => void;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      {template === "rotate" ? (
        <>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-foreground">Old owner address</span>
            <input
              type="text"
              value={secondaryAddress}
              onChange={(e) => onChange({ secondaryAddress: e.target.value })}
              placeholder="0x…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-foreground">New owner address</span>
            <input
              type="text"
              value={primaryAddress}
              onChange={(e) => onChange({ primaryAddress: e.target.value })}
              placeholder="0x…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Rotate uses <code className="text-[11px]">swapOwner</code> and keeps the current
            threshold on each Safe.
          </p>
        </>
      ) : (
        <>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-foreground">
              {template === "add" ? "New signer address" : "Signer to remove"}
            </span>
            <input
              type="text"
              value={primaryAddress}
              onChange={(e) => onChange({ primaryAddress: e.target.value })}
              placeholder="0x…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-foreground">New threshold</span>
            <input
              type="number"
              min={1}
              value={threshold}
              onChange={(e) => onChange({ threshold: e.target.value })}
              className="w-full max-w-[8rem] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            />
            <span className="block text-xs text-muted-foreground">
              Must be between 1 and the resulting owner count on each selected Safe.
            </span>
          </label>
        </>
      )}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
