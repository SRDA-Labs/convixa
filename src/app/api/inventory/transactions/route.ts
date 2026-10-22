import { NextRequest, NextResponse } from "next/server";
import { asc, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/api-helpers";
import { getDefaultTeams } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { safes } from "@/lib/db/schema";
import {
  aggregateInventoryTransactions,
  decodeInventoryTxCursor,
  encodeInventoryTxCursor,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from "@/lib/inventory/aggregate-transactions";
import type { InventoryTxStatusFilter } from "@/lib/inventory/types";
import { uuidSchema } from "@/lib/validations";

function parseStatus(raw: string | null): InventoryTxStatusFilter {
  if (raw === "proposed" || raw === "executed" || raw === "cancelled" || raw === "all") {
    return raw;
  }
  return "all";
}

/** GET /api/inventory/transactions – org-wide latest multisig txs across inventory. */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = req.nextUrl;
  const status = parseStatus(searchParams.get("status"));
  const limit = Math.min(
    Math.max(
      1,
      parseInt(searchParams.get("limit") ?? String(DEFAULT_PAGE_LIMIT), 10) || DEFAULT_PAGE_LIMIT
    ),
    MAX_PAGE_LIMIT
  );
  const cursor = decodeInventoryTxCursor(searchParams.get("cursor"));

  const teamIdRaw = searchParams.get("teamId")?.trim() || null;
  if (teamIdRaw) {
    const parsed = uuidSchema.safeParse(teamIdRaw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid teamId" }, { status: 400 });
    }
  }

  const userTeams = await getDefaultTeams();
  const teamIds = userTeams.map((t) => t.teamId);
  if (teamIds.length === 0) {
    return NextResponse.json({
      transactions: [],
      nextCursor: null,
      meta: { safeCount: 0, totalSafes: 0, truncated: false, partialErrors: 0 },
    });
  }

  const scopedTeamIds =
    teamIdRaw && teamIds.includes(teamIdRaw) ? [teamIdRaw] : teamIds;

  const safesList = await db
    .select({
      id: safes.id,
      address: safes.address,
      network: safes.network,
      name: safes.name,
    })
    .from(safes)
    .where(inArray(safes.teamId, scopedTeamIds))
    .orderBy(asc(safes.name), asc(safes.createdAt));

  const result = await aggregateInventoryTransactions({
    safes: safesList,
    status,
    limit,
    cursor,
  });

  return NextResponse.json({
    transactions: result.transactions,
    nextCursor: result.nextCursor
      ? encodeInventoryTxCursor(result.nextCursor)
      : null,
    meta: result.meta,
  });
}
