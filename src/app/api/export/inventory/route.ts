import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { safes, safeSnapshots, teams } from "@/lib/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { getDefaultOrgId, getDefaultTeams, hasPermission } from "@/lib/auth-server";

function escapeCsv(s: string): string {
  if (/[,"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = await getDefaultOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "No org" }, { status: 400 });
  }
  if (!(await hasPermission("export:inventory", orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userTeams = await getDefaultTeams();
  const teamIds = userTeams.map((t) => t.teamId);
  if (teamIds.length === 0) {
    return NextResponse.json({ error: "No teams" }, { status: 400 });
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
      threshold: safeSnapshots.threshold,
      owners: safeSnapshots.owners,
      pendingCount: safeSnapshots.pendingCount,
      lastTxAt: safeSnapshots.lastTxAt,
      refreshedAt: safeSnapshots.refreshedAt,
    })
    .from(safes)
    .leftJoin(safeSnapshots, eq(safes.id, safeSnapshots.safeId))
    .innerJoin(teams, eq(safes.teamId, teams.id))
    .where(inArray(safes.teamId, teamIds))
    .orderBy(safes.createdAt);

  // One row per safe (latest snapshot)
  const bySafe = new Map<string, (typeof list)[0]>();
  const sorted = [...list].sort((a, b) => {
    const aT = a.refreshedAt ? new Date(a.refreshedAt).getTime() : 0;
    const bT = b.refreshedAt ? new Date(b.refreshedAt).getTime() : 0;
    return bT - aT;
  });
  for (const row of sorted) {
    if (!bySafe.has(row.id)) bySafe.set(row.id, row);
  }
  const rows = Array.from(bySafe.values());

  function parseJsonArray(v: unknown): unknown[] {
    if (v == null) return [];
    // If it's already an array (from PostgreSQL JSON column), return it
    if (Array.isArray(v)) return v;
    // Otherwise try to parse it as a JSON string (for backward compatibility)
    if (typeof v === 'string') {
      try {
        const a = JSON.parse(v);
        return Array.isArray(a) ? a : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  const headers = [
    "Address",
    "Network",
    "Name",
    "Tags",
    "Team",
    "Threshold",
    "Signer Count",
    "Pending Count",
    "Last Tx At",
    "Last Refreshed",
    "Created At",
  ];
  const lines: string[] = [
    headers.map(escapeCsv).join(","),
    ...rows.map((r) =>
      [
        r.address,
        r.network,
        r.name ?? "",
        parseJsonArray(r.tags).join("; "),
        r.teamName ?? "",
        r.threshold ?? "",
        parseJsonArray(r.owners).length,
        r.pendingCount ?? 0,
        r.lastTxAt ?? "",
        r.refreshedAt ?? "",
        r.createdAt ?? "",
      ]
        .map(String)
        .map(escapeCsv)
        .join(",")
    ),
  ];

  const csv = lines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="safe-inventory-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
