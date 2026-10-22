import { NextResponse } from "next/server";
import { requireAuthAndOrg } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { safeConfigEvents, safes } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";

const ROTATION_EVENT_TYPES = [
  "SIGNER_ADDED",
  "SIGNER_REMOVED",
  "SIGNER_SWAPPED",
  "THRESHOLD_CHANGED",
  "THRESHOLD_DECREASED",
  "SIGNER_COUNT_DECREASED",
] as const;

export async function GET(req: Request) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:read", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const format = new URL(req.url).searchParams.get("format") ?? "json";

  const rows = await db
    .select({
      event: safeConfigEvents,
      safeName: safes.name,
      safeAddress: safes.address,
      network: safes.network,
    })
    .from(safeConfigEvents)
    .innerJoin(safes, eq(safeConfigEvents.safeId, safes.id))
    .where(
      and(
        eq(safes.orgId, auth.orgId),
        inArray(safeConfigEvents.eventType, [...ROTATION_EVENT_TYPES])
      )
    )
    .orderBy(desc(safeConfigEvents.createdAt));

  const payload = rows.map((r) => ({
    safeName: r.safeName,
    safeAddress: r.safeAddress,
    network: r.network,
    eventType: r.event.eventType,
    safeTxHash: r.event.safeTxHash,
    before: r.event.beforeJson,
    after: r.event.afterJson,
    createdAt: r.event.createdAt,
  }));

  if (format === "csv") {
    const headers = [
      "safe_name",
      "safe_address",
      "network",
      "event_type",
      "safe_tx_hash",
      "created_at",
    ];
    const lines = [
      headers.join(","),
      ...payload.map((r) =>
        [
          r.safeName ?? "",
          r.safeAddress,
          r.network,
          r.eventType,
          r.safeTxHash ?? "",
          r.createdAt?.toISOString() ?? "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="signer-rotation-export.csv"',
      },
    });
  }

  return NextResponse.json({ exportedAt: new Date().toISOString(), events: payload });
}
