"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type ConfigEvent = {
  id: string;
  eventType: string;
  source: string;
  safeTxHash: string | null;
  beforeJson: unknown;
  afterJson: unknown;
  severity: string;
  createdAt: string;
};

type ProposedEvent = {
  id: string;
  eventType: string;
  safeTxHash: string;
  metadata: unknown;
  createdAt: string;
};

function formatEventType(t: string): string {
  return t.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function severityClass(severity: string): string {
  if (severity === "critical") return "bg-destructive/10 text-destructive";
  if (severity === "warning") return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

export function ConfigChangeTimeline({ safeId }: { safeId: string }) {
  const [events, setEvents] = useState<ConfigEvent[]>([]);
  const [proposed, setProposed] = useState<ProposedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/safes/${safeId}/config-events`)
      .then((r) => (r.ok ? r.json() : { events: [], proposed: [] }))
      .then((d) => {
        setEvents(d.events ?? []);
        setProposed(d.proposed ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [safeId]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (events.length === 0 && proposed.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        No configuration changes recorded yet. Refresh the safe to detect owner or threshold updates.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {proposed.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Proposed (pending execution)
          </h3>
          <ul className="space-y-2">
            {proposed.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <span className="font-medium">{formatEventType(e.eventType)}</span>
                  <span className="text-muted-foreground ml-2">
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-amber-600/40 px-2 py-0.5 text-[10px] font-medium hover:bg-amber-500/10"
                  onClick={async () => {
                    const caseType =
                      e.eventType.includes("SIGNER_ADD") || e.eventType.includes("SIGNER_SWAP")
                        ? "signer_add"
                        : e.eventType.includes("SIGNER_REMOVE")
                          ? "signer_remove"
                          : e.eventType.includes("THRESHOLD")
                            ? "threshold_change"
                            : "guard_module_change";
                    await fetch(`/api/safes/${safeId}/oob-cases`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        safeTxHash: e.safeTxHash,
                        normalizedEventId: e.id,
                        caseType,
                        title: `OOB: ${formatEventType(e.eventType)}`,
                      }),
                    });
                    window.location.href = "/dashboard/security/oob-cases";
                  }}
                >
                  Start OOB verification
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {events.length > 0 && (
        <ul className="space-y-2">
          {events.map((e) => (
            <li
              key={e.id}
              className="rounded-lg border border-border/80 px-3 py-2 text-xs flex flex-wrap items-center gap-2"
            >
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                  severityClass(e.severity)
                )}
              >
                {e.severity}
              </span>
              <span className="font-medium">{formatEventType(e.eventType)}</span>
              <span className="text-muted-foreground">{e.source.replace(/_/g, " ")}</span>
              <span className="text-muted-foreground ml-auto">
                {new Date(e.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
