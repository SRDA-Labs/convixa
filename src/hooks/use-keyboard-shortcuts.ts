"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const SHORTCUTS: Record<string, { url: string; description: string }> = {
  "1": { url: "/dashboard", description: "Dashboard" },
  "2": { url: "/dashboard/inventory", description: "Inventory" },
  "3": { url: "/dashboard/alerts", description: "Alerts" },
  "4": { url: "/dashboard/teams", description: "Teams" },
  "5": { url: "/dashboard/controls", description: "Controls" },
  "6": { url: "/dashboard/settings", description: "Settings" },
};

export function useDashboardShortcuts() {
  const router = useRouter();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      // Don't fire inside inputs, textareas, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      const shortcut = SHORTCUTS[e.key];
      if (shortcut) {
        e.preventDefault();
        router.push(shortcut.url);
      }
    },
    [router]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
