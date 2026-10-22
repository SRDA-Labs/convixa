"use client";

import { useCallback } from "react";
import { Search } from "lucide-react";

export function CommandPaletteTrigger({ onOpen }: { onOpen?: () => void }) {
  const handleOpen = useCallback(() => {
    if (onOpen) {
      onOpen();
      return;
    }
    // Dispatch ⌘K to trigger the existing DashboardSearchBar modal
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
    );
  }, [onOpen]);

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="hidden md:flex items-center gap-2 w-56 rounded-md border border-border bg-card/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      aria-label="Open command palette"
    >
      <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="flex-1 text-left truncate">Search safes, addresses, teams…</span>
      <kbd className="text-[10px] font-semibold border border-border rounded px-1 py-0 text-text-tertiary">⌘K</kbd>
    </button>
  );
}
