"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bell,
  Shield,
  Users,
  UserPlus,
  PenLine,
} from "lucide-react";
import type { NotificationItem } from "@/app/api/notifications/route";

const STORAGE_KEY = "convixa_notifications_read_at";

function NotificationIcon({ type }: { type: string }) {
  const iconClass = "text-primary shrink-0 mt-0.5 text-[20px] w-5 h-5";
  if (type === "new_safe") {
    return <Shield className={iconClass} aria-hidden />;
  }
  if (type === "new_member" || type === "invite_accepted") {
    return type === "new_member" ? <Users className={iconClass} aria-hidden /> : <UserPlus className={iconClass} aria-hidden />;
  }
  if (type === "pending_approval") {
    return <PenLine className={iconClass} aria-hidden />;
  }
  return <Bell className={iconClass} aria-hidden />;
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastReadAt, setLastReadAt] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(
    (n) => new Date(n.createdAt).getTime() > (lastReadAt ?? 0)
  ).length;

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    setLastReadAt(raw ? parseInt(raw, 10) : null);
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const markAllRead = () => {
    const now = Date.now();
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, String(now));
    setLastReadAt(now);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={open ? "Close notifications" : "Notifications"}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5 shrink-0" aria-hidden />
        {unreadCount > 0 && (
          <span
            className="absolute top-2 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-background"
            aria-hidden
          />
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-card text-card-foreground shadow-lg overflow-hidden z-[60] text-left flex flex-col"
          role="dialog"
          aria-label="Recent activity"
        >
          <div className="px-4 py-3 border-b border-border flex justify-between items-center bg-card">
            <div className="flex items-center gap-2">
              <div className="w-1 h-3 bg-primary rounded-full" />
              <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Recent Activity
              </h3>
            </div>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[10px] text-primary font-medium hover:text-primary/80 uppercase tracking-wider transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[400px] overflow-y-auto custom-scrollbar flex-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No recent activity.
              </div>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.link}
                      onClick={() => setOpen(false)}
                      className="block px-4 py-4 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors cursor-pointer"
                    >
                      <div className="flex gap-4">
                        <div className="mt-0.5 flex-shrink-0">
                          <NotificationIcon type={n.type} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-foreground">{n.title}</p>
                          <p className="text-[12px] text-muted-foreground mt-1 leading-normal line-clamp-2">
                            {n.description}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70 mt-2 uppercase tracking-wide">
                            {n.relativeTime}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            href="/dashboard/audit"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-center text-[11px] font-semibold text-primary hover:text-primary/80 hover:bg-muted/40 transition-colors border-t border-border uppercase tracking-[0.1em]"
          >
            View Historical Log
          </Link>
        </div>
      )}
    </div>
  );
}
