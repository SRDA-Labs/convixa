"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Download } from "lucide-react";
import { cn } from "@/lib/cn";

type Metrics = {
  computedAt: string;
  readinessScore: number;
  timelockCoveragePct: number;
  twinCoveragePct: number;
  activeWebhooks: number;
  criticalPolicyGaps: number;
  pendingWithoutSimulation: number;
  daysSinceCertificationExport: number | null;
  webhookHealth: Array<{
    id: string;
    safeAddress: string;
    network: string;
    status: string;
    lastReceivedAt: string | null;
    stale: boolean;
  }>;
  topPolicyGaps: Array<{
    safeId: string;
    safeName: string | null;
    gapId: string;
    severity: string;
    message: string;
  }>;
};

function Tile({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 bg-card",
        warn ? "border-amber-500/40" : "border-border"
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function severityClass(s: string): string {
  if (s === "critical") return "text-destructive bg-destructive/10";
  if (s === "warn") return "text-amber-600 bg-amber-500/10";
  return "text-muted-foreground bg-muted";
}

export function GovernanceClient({ canManage }: { canManage: boolean }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  function load() {
    return fetch("/api/org/governance")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.metrics) setMetrics(d.metrics);
      });
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading governance metrics…
      </div>
    );
  }

  if (!metrics) {
    return <p className="text-sm text-muted-foreground">Unable to load governance data.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Refresh
        </button>
        <a
          href="/api/org/policy-gap?format=csv"
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted"
        >
          <Download className="h-3.5 w-3.5" />
          Export policy gaps
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Tile label="Readiness score" value={`${metrics.readinessScore}%`} />
        <Tile
          label="Timelock coverage"
          value={`${metrics.timelockCoveragePct}%`}
          warn={metrics.timelockCoveragePct < 100}
          sub="Treasury / protocol-critical safes"
        />
        <Tile
          label="Testnet twin coverage"
          value={`${metrics.twinCoveragePct}%`}
          warn={metrics.twinCoveragePct < 80}
        />
        <Tile label="Active webhooks" value={String(metrics.activeWebhooks)} />
        <Tile
          label="Critical policy gaps"
          value={String(metrics.criticalPolicyGaps)}
          warn={metrics.criticalPolicyGaps > 0}
        />
        <Tile
          label="Pending w/o simulation"
          value={String(metrics.pendingWithoutSimulation)}
          warn={metrics.pendingWithoutSimulation > 0}
        />
      </div>

      {metrics.topPolicyGaps.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h2 className="text-sm font-medium">Top policy gaps</h2>
          </div>
          <ul className="divide-y divide-border">
            {metrics.topPolicyGaps.map((g) => (
              <li key={`${g.safeId}-${g.gapId}`} className="px-4 py-3 flex items-start gap-3">
                <span
                  className={cn(
                    "text-[10px] uppercase font-medium px-1.5 py-0.5 rounded",
                    severityClass(g.severity)
                  )}
                >
                  {g.severity}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{g.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {g.safeName ?? g.safeId.slice(0, 8)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canManage && (
        <div className="rounded-xl border border-border p-4 space-y-3">
          <h2 className="text-sm font-medium">Real-time monitoring</h2>
          <p className="text-xs text-muted-foreground">
            Register webhooks per Safe to ingest Safe Transaction Service events. Configure{" "}
            <code className="text-[11px]">SAFE_WEBHOOK_BASE_URL</code> in your deployment env.
          </p>
          {metrics.webhookHealth.length === 0 ? (
            <p className="text-sm text-muted-foreground">No webhook subscriptions yet.</p>
          ) : (
            <ul className="text-sm space-y-2">
              {metrics.webhookHealth.map((w) => (
                <li key={w.id} className="flex justify-between gap-2">
                  <span className="font-mono text-xs truncate">{w.safeAddress}</span>
                  <span className={cn("text-xs", w.stale ? "text-amber-600" : "text-muted-foreground")}>
                    {w.lastReceivedAt ? new Date(w.lastReceivedAt).toLocaleString() : "No events yet"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
