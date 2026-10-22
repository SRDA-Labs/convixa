"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type ThemeToggleProps = {
  /** Extra classes for the fixed wrapper (e.g. `bottom-10` above a footer). */
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  function toggle() {
    setFlipping(true);
    setTheme(isDark ? "light" : "dark");
    window.setTimeout(() => setFlipping(false), 400);
  }

  return (
    <div className={cn("fixed bottom-6 right-6 z-50", className)}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "w-10 h-10 rounded-lg border border-border bg-card text-foreground",
          "flex items-center justify-center shadow-lg",
          "hover:border-primary hover:bg-muted/50",
          "transition-colors active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        <span
          className={cn(
            "inline-flex transition-transform duration-500 ease-out",
            flipping && "rotate-180"
          )}
        >
          <Sun className="h-5 w-5 text-amber-500 dark:hidden" aria-hidden />
          <Moon className="h-5 w-5 text-blue-400 hidden dark:block" aria-hidden />
        </span>
      </button>
    </div>
  );
}
