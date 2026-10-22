import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { safes, safeSnapshots, teams } from "@/lib/db/schema";
import { evaluateComplianceFromSnapshot, rosterRowsToComplianceEntries } from "@/lib/seal-compliance/evaluate";
import { getRosterBySafeIds } from "@/lib/db/repositories/safe-signer-roster.repository";
import { eq, inArray, desc } from "drizzle-orm";
import { getDefaultTeams, getDefaultOrgId } from "@/lib/auth-server";
import { AddSafeButton } from "@/components/add-safe-button";
import { AddSafeModalOpenFromQuery } from "@/components/add-safe-modal-open-from-query";
import { InventoryTable } from "./inventory-table";
import { InventoryTeamFilter } from "./inventory-team-filter";
import { DiscoveredFromWallet } from "./discovered-from-wallet";
import type { SafeRow } from "./inventory-table";
import { Shield, PlusCircle } from "lucide-react";

function PageHeader({
  safeCount,
  pendingCount,
  showActions,
}: {
  safeCount: number;
  pendingCount: number;
  showActions: boolean;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Inventory</h1>
        <p className="text-sm text-muted-foreground">Safes across your teams</p>
        {showActions && (
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground tabular-nums">{safeCount}</span> safe{safeCount !== 1 ? "s" : ""}
            </span>
            <span className="text-border" aria-hidden>
              ·
            </span>
            <span>
              <span className="font-medium text-primary tabular-nums">{pendingCount}</span> pending
            </span>
          </div>
        )}
      </div>
      {showActions && (
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="/api/export/inventory"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            aria-label="Export inventory as CSV"
          >
            Export
          </a>
          <AddSafeButton className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 min-h-[36px]" />
        </div>
      )}
    </header>
  );
}

function EmptySafes() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 py-12 px-6 text-center">
      <Shield className="h-10 w-10 text-muted-foreground/50" aria-hidden />
      <h2 className="mt-3 text-base font-medium text-foreground">No safes yet</h2>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">Add a Safe to start tracking signers, balances, and pending transactions.</p>
      <AddSafeButton className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 min-h-[40px]">
        <PlusCircle className="h-4 w-4 shrink-0" aria-hidden />
        Add Safe
      </AddSafeButton>
    </div>
  );
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const [{ teamId: teamIdParam }] = await Promise.all([searchParams, getDefaultOrgId()]);
  const filterTeamId = teamIdParam?.trim() || null;

  const userTeams = await getDefaultTeams();
  const teamIds = userTeams.map((t) => t.teamId);

  if (teamIds.length === 0) {
    return (
      <>
        <AddSafeModalOpenFromQuery />
        <PageHeader safeCount={0} pendingCount={0} showActions={false} />
        <EmptySafes />
      </>
    );
  }

  const list = await db
    .select({
      id: safes.id,
      address: safes.address,
      network: safes.network,
      name: safes.name,
      tags: safes.tags,
      teamId: safes.teamId,
      teamName: teams.name,
      createdAt: safes.createdAt,
      classification: safes.classification,
      purpose: safes.purpose,
      moduleExceptionNote: safes.moduleExceptionNote,
      threshold: safeSnapshots.threshold,
      owners: safeSnapshots.owners,
      modulesJson: safeSnapshots.modulesJson,
      balances: safeSnapshots.balances,
      pendingCount: safeSnapshots.pendingCount,
      lastTxAt: safeSnapshots.lastTxAt,
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
  let safesList = Array.from(bySafe.values());
  if (filterTeamId && teamIds.includes(filterTeamId)) {
    safesList = safesList.filter((s) => s.teamId === filterTeamId);
  }

  const totalPending = safesList.reduce((sum, s) => sum + (s.pendingCount ?? 0), 0);

  const allRosterRows = await getRosterBySafeIds(safesList.map((s) => s.id));
  const rosterBySafe = new Map<string, typeof allRosterRows>();
  for (const row of allRosterRows) {
    const list = rosterBySafe.get(row.safeId) ?? [];
    list.push(row);
    rosterBySafe.set(row.safeId, list);
  }

  const tableRows: SafeRow[] = safesList.map((s) => {
    const ownersRaw = s.owners;
    const owners: string | null =
      ownersRaw == null
        ? null
        : typeof ownersRaw === "string"
          ? ownersRaw
          : Array.isArray(ownersRaw)
            ? JSON.stringify(ownersRaw)
            : null;
    const compliance = evaluateComplianceFromSnapshot({
      threshold: s.threshold ?? null,
      owners: ownersRaw,
      classification: s.classification ?? null,
      purpose: s.purpose ?? null,
      moduleExceptionNote: s.moduleExceptionNote ?? null,
      modulesJson: s.modulesJson ?? null,
      balances: s.balances ?? null,
      roster: rosterRowsToComplianceEntries(rosterBySafe.get(s.id) ?? []),
    });
    return {
      id: s.id,
      address: s.address,
      network: s.network,
      name: s.name,
      teamId: s.teamId,
      teamName: s.teamName ?? "",
      threshold: s.threshold ?? null,
      owners,
      pendingCount: s.pendingCount ?? null,
      refreshedAt: s.refreshedAt ? s.refreshedAt.toISOString() : null,
      complianceWarn: compliance.warn,
      complianceFail: compliance.fail,
    };
  });

  return (
    <>
      <AddSafeModalOpenFromQuery />
      <PageHeader safeCount={safesList.length} pendingCount={totalPending} showActions />

      {userTeams.length > 1 && (
        <InventoryTeamFilter
          teams={userTeams.map((t) => ({ teamId: t.teamId, teamName: t.teamName }))}
          currentTeamId={filterTeamId}
        />
      )}

      <DiscoveredFromWallet />

      {safesList.length === 0 ? (
        <EmptySafes />
      ) : (
        <div className="rounded-lg border border-border/80 bg-card overflow-hidden">
          <InventoryTable safesList={tableRows} showTeamColumn={userTeams.length > 1} />
        </div>
      )}
    </>
  );
}
