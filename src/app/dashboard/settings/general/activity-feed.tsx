"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface ActivityEvent {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: unknown;
  createdAt: string | null;
}

function formatActionLabel(action: string): string {
  const labels: Record<string, string> = {
    "wallet.linked": "Wallet linked",
    "wallet.unlinked": "Wallet unlinked",
    "profile.name_changed": "Name updated",
    "profile.image_changed": "Avatar updated",
    "profile.timezone_changed": "Timezone updated",
    "2fa.enabled": "2FA enabled",
    "2fa.disabled": "2FA disabled",
    "safe.added": "Safe added",
    "safe.removed": "Safe removed",
    "member.invited": "Member invited",
    "member.joined": "Member joined",
    "member.removed": "Member removed",
    "org.created": "Organization created",
    "login": "Signed in",
    "password.changed": "Password changed",
  };
  return labels[action] ?? action;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

interface ActivityFeedProps {
  compact?: boolean;
}

export function ActivityFeed({ compact }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/profile/activity")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load activity");
        return r.json();
      })
      .then((d) => setEvents(d.events ?? []))
      .catch(() => setError("Could not load activity."))
      .finally(() => setLoading(false));
  }, []);

  const inner = (() => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
        </div>
      );
    }

    if (error) {
      return (
        <div className="py-4">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      );
    }

    if (events.length === 0) {
      return (
        <div className="py-6 text-center">
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-border/40">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-center justify-between gap-4 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm text-foreground truncate">
                {formatActionLabel(event.action)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {event.resourceType}
                {event.resourceId
                  ? ` \u2022 ${event.resourceId.slice(0, 8)}\u2026`
                  : ""}
              </p>
            </div>
            <time
              dateTime={event.createdAt ?? undefined}
              className="text-xs text-muted-foreground shrink-0 tabular-nums"
            >
              {formatRelativeTime(event.createdAt)}
            </time>
          </div>
        ))}
      </div>
    );
  })();

  if (compact) return inner;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-start gap-3 border-b border-border/60 px-5 py-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
          <svg className="h-3.5 w-3.5 text-muted-foreground" aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your recent actions across this organization.
          </p>
        </div>
      </div>
      <div className="px-5 py-4">{inner}</div>
    </div>
  );
}
