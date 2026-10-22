import Link from "next/link";
import { getServerSession } from "next-auth";
import { getAddress } from "viem";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { safes, safeSnapshots, teams } from "@/lib/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { getDefaultTeams, getDefaultOrgId } from "@/lib/auth-server";
import { getSafeTxServiceBaseUrl, safeApiFetch } from "@/lib/safe-api";
import { getAuditLogsByOrg } from "@/lib/db/repositories";
import { AddSafeButton } from "@/components/add-safe-button";
import { AggregatedActivitySidebar } from "@/components/aggregated-activity-sidebar";
import { ManagedSafesTable } from "@/components/managed-safes-table";
import { AnimatedKPICard } from "@/components/animated-kpi-card";
import { SignerQueueWidget } from "@/components/signer-queue-widget";
import { Shield, Wallet, Layers, AlertCircle, PlusCircle } from "lucide-react";

const MAX_SAFES_FOR_BALANCE = 15;

function formatBalance(balance: string, decimals: number, symbol: string): string {
  try {
    const n = BigInt(balance);
    if (n === BigInt(0)) return `0 ${symbol}`;
    const divisor = 10 ** decimals;
    const whole = n / BigInt(divisor);
    const frac = n % BigInt(divisor);
    const fracStr = frac.toString().padStart(decimals, "0").slice(0, decimals).replace(/0+$/, "") || "0";
    const fracTrim = fracStr.slice(0, 4);
    if (whole > BigInt(0)) {
      return `${whole}${fracTrim !== "0" ? "." + fracTrim : ""} ${symbol}`;
    }
    return `< 0.001 ${symbol}`;
  } catch {
    return `— ${symbol}`;
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const orgId = await getDefaultOrgId();

  const userTeams = await getDefaultTeams();
  const teamIds = userTeams.map((t) => t.teamId);
  if (teamIds.length === 0) {
    return (
      <div className="min-w-0 space-y-8">
        <div className="border-b border-border pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl text-pretty">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">Summary of your organization&apos;s multisig safes</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-16 px-6 text-center">
          <Shield className="h-12 w-12 text-muted-foreground/60" aria-hidden />
          <h2 className="mt-4 text-lg font-semibold text-foreground text-pretty">No safes yet</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Add a Safe to your organization to see an overview of balances, signers, and activity here.
          </p>
          <AddSafeButton
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 min-h-[44px]"
          >
            <PlusCircle className="h-4 w-4 shrink-0" aria-hidden />
            Add Safe
          </AddSafeButton>
        </div>
      </div>
    );
  }

  const list = await db
    .select({
      id: safes.id,
      address: safes.address,
      network: safes.network,
      name: safes.name,
      teamId: safes.teamId,
      teamName: teams.name,
      threshold: safeSnapshots.threshold,
      owners: safeSnapshots.owners,
      pendingCount: safeSnapshots.pendingCount,
      refreshedAt: safeSnapshots.refreshedAt,
    })
    .from(safes)
    .leftJoin(safeSnapshots, eq(safes.id, safeSnapshots.safeId))
    .innerJoin(teams, eq(safes.teamId, teams.id))
    .where(inArray(safes.teamId, teamIds))
    .orderBy(desc(safes.createdAt));

  const bySafe = new Map<string, (typeof list)[0]>();
  const sorted = [...list].sort((a, b) => {
    const aT = a.refreshedAt ? new Date(a.refreshedAt).getTime() : 0;
    const bT = b.refreshedAt ? new Date(b.refreshedAt).getTime() : 0;
    return bT - aT;
  });
  for (const row of sorted) {
    if (!bySafe.has(row.id)) bySafe.set(row.id, row);
  }
  const rawList = Array.from(bySafe.values());
  const safesList = rawList.map((s) => {
    const ownersRaw = s.owners;
    const owners: string | null =
      ownersRaw == null
        ? null
        : typeof ownersRaw === "string"
          ? ownersRaw
          : Array.isArray(ownersRaw)
            ? JSON.stringify(ownersRaw)
            : typeof ownersRaw === "object" && ownersRaw !== null
              ? JSON.stringify(ownersRaw)
              : null;
    return {
      id: s.id,
      address: s.address,
      network: s.network,
      name: s.name,
      teamId: s.teamId,
      teamName: s.teamName,
      threshold: s.threshold,
      owners,
      pendingCount: s.pendingCount,
      refreshedAt: s.refreshedAt ? s.refreshedAt.toISOString() : null,
    };
  });

  const safeCount = safesList.length;
  const totalPending = safesList.reduce((sum, s) => sum + (s.pendingCount ?? 0), 0);

  const allOwnerSets = safesList.map((s) => {
    if (s.owners == null) return [];
    try {
      return typeof s.owners === "string" ? (JSON.parse(s.owners) as string[]) : (s.owners as string[]);
    } catch {
      return [];
    }
  });
  const uniqueSigners = new Set(allOwnerSets.flat()).size;

  const safesForBalance = safesList.slice(0, MAX_SAFES_FOR_BALANCE);
  const aggregatedByToken: Map<string, { balance: bigint; decimals: number; symbol: string }> = new Map();
  for (const safe of safesForBalance) {
    try {
      const safeAddress = getAddress(safe.address);
      const base = getSafeTxServiceBaseUrl(safe.network);
      const res = await safeApiFetch(
        `${base}api/v1/safes/${safeAddress}/balances/?trusted=false`
      );
      if (!res.ok) continue;
      const data = (await res.json()) as {
        results?: Array<{
          token?: { symbol?: string; decimals?: number } | null;
          balance?: string;
        }>;
      };
      const results = data.results ?? [];
      for (const r of results) {
        const symbol = r.token?.symbol ?? "ETH";
        const decimals = r.token?.decimals ?? 18;
        const balance = BigInt(r.balance ?? "0");
        const key = `${symbol}:${decimals}`;
        const existing = aggregatedByToken.get(key);
        if (existing) {
          aggregatedByToken.set(key, {
            ...existing,
            balance: existing.balance + balance,
          });
        } else {
          aggregatedByToken.set(key, { balance, decimals, symbol });
        }
      }
    } catch {
      // skip this safe
    }
  }
  const totalBalances = Array.from(aggregatedByToken.entries())
    .filter(([, v]) => v.balance > BigInt(0))
    .map(([, v]) => ({ ...v, balanceStr: v.balance.toString() }))
    .sort((a, b) => {
      if (a.symbol === "ETH" && b.symbol !== "ETH") return -1;
      if (b.symbol === "ETH" && a.symbol !== "ETH") return 1;
      return b.balance > a.balance ? 1 : a.balance > b.balance ? -1 : 0;
    });

  const auditLogs = orgId ? await getAuditLogsByOrg(orgId, { limit: 20 }) : [];
  const auditEntries = auditLogs.map((log) => ({
    id: log.id,
    action: log.action,
    resourceType: log.resourceType,
    resourceId: log.resourceId,
    metadata: log.metadata,
    createdAt: log.createdAt,
  }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
      <div className="min-w-0 space-y-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Overview
          </h1>
          <p className="text-xs text-text-tertiary mt-1">
            Summary of your organization&apos;s multisig safes, balances, and activity.
          </p>
        </header>

        {/* Stat cards — aligned with reference HTML */}
        <section className="mb-8" aria-labelledby="overview-stats-heading">
          <h2 id="overview-stats-heading" className="sr-only">
            Overview statistics
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AnimatedKPICard className="rounded-lg border border-border bg-card p-5 group">
              <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">Total Safes</p>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold tabular-nums text-foreground">{safeCount}</span>
                <Shield className="h-5 w-5 text-text-tertiary group-hover:text-primary transition-colors shrink-0" aria-hidden />
              </div>
            </AnimatedKPICard>

            <AnimatedKPICard className="rounded-lg border border-border bg-card p-5 group">
              <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">Aggregate Balance</p>
                <div className="flex items-center justify-between gap-2">
                  {totalBalances.length === 0 ? (
                    <span className="text-3xl font-bold text-muted-foreground">—</span>
                  ) : (
                    <span className="text-3xl font-bold tabular-nums text-foreground flex flex-wrap gap-x-2 min-w-0">
                      {totalBalances.slice(0, 3).map((t, i) => (
                        <span key={i} className="whitespace-nowrap">{formatBalance(t.balanceStr, t.decimals, t.symbol)}</span>
                      ))}
                      {totalBalances.length > 3 && (
                        <span className="text-muted-foreground font-medium whitespace-nowrap">+{totalBalances.length - 3}</span>
                      )}
                    </span>
                  )}
                  <Wallet className="h-5 w-5 text-text-tertiary group-hover:text-primary transition-colors shrink-0" aria-hidden />
                </div>
                {safesList.length > MAX_SAFES_FOR_BALANCE && (
                  <p className="mt-1 text-[10px] text-muted-foreground">First {MAX_SAFES_FOR_BALANCE} safes</p>
                )}
            </AnimatedKPICard>

            <AnimatedKPICard className="rounded-lg border border-border bg-card p-5 group">
              <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">Pending Approvals</p>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold tabular-nums text-primary">{totalPending}</span>
                <AlertCircle className="h-5 w-5 text-text-tertiary group-hover:text-primary transition-colors shrink-0" aria-hidden />
              </div>
            </AnimatedKPICard>

            <AnimatedKPICard className="rounded-lg border border-border bg-card p-5 group">
              <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">Total Signers</p>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold tabular-nums text-foreground">{uniqueSigners}</span>
                <Layers className="h-5 w-5 text-text-tertiary group-hover:text-primary transition-colors shrink-0" aria-hidden />
              </div>
            </AnimatedKPICard>
          </div>
        </section>

        {/* My Queue widget */}
        <section className="mb-8" aria-labelledby="my-queue-heading">
          <h2
            id="my-queue-heading"
            className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4"
          >
            My Queue
          </h2>
          <SignerQueueWidget />
        </section>

        {/* Managed Safes table */}
        <section className="min-w-0" aria-labelledby="managed-safes-heading">
          <div className="flex items-center justify-between mb-4">
            <h2
              id="managed-safes-heading"
              className="text-xs font-bold text-muted-foreground uppercase tracking-widest"
            >
              Managed Safes
            </h2>
            <Link
              href="/dashboard/inventory"
              className="text-[10px] font-bold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 rounded"
            >
              Manage All Safes
            </Link>
          </div>
          <ManagedSafesTable safesList={safesList} />
        </section>
      </div>

      <AggregatedActivitySidebar entries={auditEntries} />
    </div>
  );
}
