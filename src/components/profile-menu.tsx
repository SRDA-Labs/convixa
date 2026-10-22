"use client";

import { useState, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { User, LogOut, ChevronRight } from "lucide-react";

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const display = name || email || "?";
  return display
    .split(/[ @.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");
}

export function ProfileMenu() {
  const { data: session } = useSession();
  const user = session?.user;
  const name = user?.name ?? null;
  const email = user?.email ?? null;

  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scheduleClose = useCallback(() => {
    timeoutRef.current = setTimeout(() => setOpen(false), 120);
  }, []);

  const cancelClose = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      {/* Trigger button */}
      <button
        type="button"
        className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full border border-border bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
        aria-label="Profile menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <User className="h-4 w-4 shrink-0" aria-hidden />
      </button>

      {/* Dropdown */}
      <div
        role="menu"
        aria-label="Profile actions"
        className={`absolute right-0 top-full mt-1.5 w-56 origin-top-right rounded-xl border border-border bg-card shadow-lg z-50 transition-all duration-150 ${
          open
            ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
            : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
        }`}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
      >
        {/* User info header */}
        <div className="px-4 pt-3.5 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10">
              <span className="text-sm font-bold tracking-tight text-primary">
                {initials(name, email)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {name || "Unnamed User"}
              </p>
              {email && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {email}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border/60" />

        {/* Menu items */}
        <div className="py-1.5">
          <Link
            href="/dashboard/settings/general"
            role="menuitem"
            className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors mx-1 rounded-lg"
            onClick={() => setOpen(false)}
          >
            <span className="flex items-center gap-2.5">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
              Profile
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" aria-hidden />
          </Link>

          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors mx-1 rounded-lg"
            onClick={async () => {
              setOpen(false);
              await fetch("/api/auth/revoke-sessions", { method: "POST" }).catch(() => {});
              signOut({ callbackUrl: "/" });
            }}
          >
            <span className="flex items-center gap-2.5">
              <LogOut className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
              Log out
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
