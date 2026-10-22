import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { asc, eq, inArray } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { getDefaultTeams } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { safes, safeSnapshots } from "@/lib/db/schema";
import {
  aggregateInventoryTransactions,
  encodeInventoryTxCursor,
} from "@/lib/inventory/aggregate-transactions";
import type { InventoryTxStatusFilter } from "@/lib/inventory/types";
import { parseOwnersJson } from "@/lib/safe-propose/owner-change";
import type { ProposeSafeOption } from "@/components/propose-tx/types";
import { InventoryTeamFilter } from "../inventory-team-filter";
import { TransactionsFeedClient } from "./transactions-feed-client";
import { ProposeTxButton } from "./propose-tx-button";

export const dynamic = "force-dynamic";

function parseStatus(raw: string | undefined): InventoryTxStatusFilter {
  if (raw === "proposed" || raw === "executed" || raw === "cancelled" || raw === "all") {
    return raw;
  }
  return "all";
}

export default async function InventoryTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string; status?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const params = await searchParams;
  const filterTeamId = params.teamId?.trim() || null;
  const status = parseStatus(params.status);

  const userTeams = await getDefaultTeams();
  const teamIds = userTeams.map((t) => t.teamId);
  const teamsForFilter = userTeams.map((t) => ({
    teamId: t.teamId,
    teamName: t.teamName,
  }));

  if (teamIds.length === 0) {
    return (
      <>
        <header className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Latest activity across inventory multisigs
          </p>
        </header>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 py-12 px-6 text-center">
          <h2 className="text-base font-medium text-foreground">No safes yet</h2>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Add a Safe in Inventory to see proposed and executed transactions here.
          </p>
        </div>
      </>
    );
  }

  const scopedTeamIds =
    filterTeamId && teamIds.includes(filterTeamId) ? [filterTeamId] : teamIds;

  const safesWithSnapshots = await db
    .select({
      id: safes.id,
      address: safes.address,
      network: safes.network,
      name: safes.name,
      threshold: safeSnapshots.threshold,
      owners: safeSnapshots.owners,
      refreshedAt: safeSnapshots.refreshedAt,
    })
    .from(safes)
    .leftJoin(safeSnapshots, eq(safes.id, safeSnapshots.safeId))
    .where(inArray(safes.teamId, scopedTeamIds))
    .orderBy(asc(safes.name), asc(safes.createdAt));

  // Dedupe snapshots (latest refreshed wins)
  const byId = new Map<string, (typeof safesWithSnapshots)[0]>();
  const byFreshness = [...safesWithSnapshots].sort((a, b) => {
    const aT = a.refreshedAt ? new Date(a.refreshedAt).getTime() : 0;
    const bT = b.refreshedAt ? new Date(b.refreshedAt).getTime() : 0;
    return bT - aT;
  });
  for (const row of byFreshness) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  // Preserve name order from query
  const orderedIds: string[] = [];
  for (const row of safesWithSnapshots) {
    if (!orderedIds.includes(row.id)) orderedIds.push(row.id);
  }

  const proposeSafes: ProposeSafeOption[] = orderedIds.map((id) => {
    const row = byId.get(id)!;
    return {
      id: row.id,
      address: row.address,
      network: row.network,
      name: row.name,
      threshold: row.threshold ?? null,
      owners: parseOwnersJson(row.owners),
    };
  });

  const safesList = proposeSafes.map((s) => ({
    id: s.id,
    address: s.address,
    network: s.network,
    name: s.name,
  }));

  const result = await aggregateInventoryTransactions({
    safes: safesList,
    status,
    limit: 50,
  });

  const teamFilterBase =
    status !== "all"
      ? `/dashboard/inventory/transactions?status=${status}`
      : "/dashboard/inventory/transactions";

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Latest activity across inventory multisigs
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <ProposeTxButton safes={proposeSafes} />
          <InventoryTeamFilter
            teams={teamsForFilter}
            currentTeamId={
              filterTeamId && teamIds.includes(filterTeamId) ? filterTeamId : null
            }
            baseHref={teamFilterBase}
          />
        </div>
      </header>

      <Suspense fallback={null}>
        <TransactionsFeedClient
          initialTransactions={result.transactions}
          initialNextCursor={
            result.nextCursor ? encodeInventoryTxCursor(result.nextCursor) : null
          }
          initialMeta={result.meta}
        />
      </Suspense>
    </>
  );
}
