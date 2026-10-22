"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Download, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";

type Metrics = {
  computedAt: string;
  overallScore: number;
  onboarding: { completionPct: number; completed: number; total: number; inProgress: number };
  drills: {
    overdueCount: number;
    dueWithin30Days: number;
    lastCompletedAt: string | null;
    activeSchedules: number;
  };
  playbooks: { publishedScenarios: number; expectedScenarios: number; staleCount: number };
  operational: { openOobCases: number; overdueOobCases: number; hasSecurityContact: boolean };
  verification: { verificationPct: number; verifiedSigners: number; totalSigners: number };
  safes: { total: number; protocolCritical: number; treasury: number };
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

function Tile({
  label,
  value,
  sub,
  href,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
  warn?: boolean;
}) {
  const inner = (
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
  if (href) {
    return (
      <Link href={href} className="block hover:opacity-90 transition-opacity">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function ReadinessClient({ canManage }: { canManage: boolean }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  function load(snapshot = false) {
    const url = snapshot ? "/api/org/readiness" : "/api/org/readiness";
    const opts = snapshot ? { method: "POST" as const } : undefined;
    return fetch(url, opts)
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
    await load(true);
    setRefreshing(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!metrics) {
    return <p className="text-sm text-muted-foreground">Could not load readiness metrics.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-muted-foreground">Overall score</span>
          <span className={cn("text-3xl font-bold", scoreColor(metrics.overallScore))}>
            {metrics.overallScore}
          </span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted/50 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </button>
          <a
            href="/api/org/readiness-export?format=csv"
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted/50"
          >
            <Download className="h-3.5 w-3.5" />
            Export pack
          </a>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Last computed {new Date(metrics.computedAt).toLocaleString()}
        {!canManage && " · Read-only view"}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile
          label="Signer onboarding"
          value={`${metrics.onboarding.completionPct}%`}
          sub={`${metrics.onboarding.completed}/${metrics.onboarding.total} complete`}
          href="/dashboard/security/onboarding"
          warn={metrics.onboarding.completionPct < 100}
        />
        <Tile
          label="Signer verification"
          value={`${metrics.verification.verificationPct}%`}
          sub={`${metrics.verification.verifiedSigners}/${metrics.verification.totalSigners} verified`}
          href="/dashboard/security/verification"
          warn={metrics.verification.verificationPct < 100}
        />
        <Tile
          label="Emergency drills"
          value={metrics.drills.overdueCount > 0 ? `${metrics.drills.overdueCount} overdue` : "Current"}
          sub={
            metrics.drills.lastCompletedAt
              ? `Last: ${new Date(metrics.drills.lastCompletedAt).toLocaleDateString()}`
              : `${metrics.drills.activeSchedules} active schedule(s)`
          }
          href="/dashboard/security/drills"
          warn={metrics.drills.overdueCount > 0}
        />
        <Tile
          label="DR playbooks"
          value={`${metrics.playbooks.publishedScenarios}/${metrics.playbooks.expectedScenarios}`}
          sub={metrics.playbooks.staleCount > 0 ? `${metrics.playbooks.staleCount} need review` : "All scenarios published"}
          href="/dashboard/security/playbooks"
          warn={metrics.playbooks.staleCount > 0}
        />
        <Tile
          label="Open OOB cases"
          value={String(metrics.operational.openOobCases)}
          sub={metrics.operational.overdueOobCases > 0 ? `${metrics.operational.overdueOobCases} overdue` : undefined}
          href="/dashboard/security/oob-cases"
          warn={metrics.operational.overdueOobCases > 0}
        />
        <Tile
          label="Safes tracked"
          value={String(metrics.safes.total)}
          sub={`${metrics.safes.treasury} treasury · ${metrics.safes.protocolCritical} protocol-critical`}
        />
      </div>

      <div className="rounded-xl border border-border p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Reports & exports</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/dashboard/security/signer-overlap" className="text-primary hover:underline">
            Signer overlap
          </Link>
          <Link href="/dashboard/security/signer-activity" className="text-primary hover:underline">
            Signer wallet activity
          </Link>
          <Link href="/dashboard/security/roster-export" className="text-primary hover:underline">
            Roster export
          </Link>
        </div>
      </div>
    </div>
  );
}
