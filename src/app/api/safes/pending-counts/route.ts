import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDefaultTeams } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { safes } from "@/lib/db/schema";
import { and, inArray } from "drizzle-orm";
import { getPendingCountLive } from "@/lib/safe-api";

const MAX_IDS = 25;

/** GET /api/safes/pending-counts?ids=id1,id2,... – batch fetch live pending tx count (same logic as alerts). */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids");
  if (!idsParam) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_IDS);
  if (ids.length === 0) {
    return NextResponse.json({});
  }

  const userTeams = await getDefaultTeams();
  const teamIds = userTeams.map((t) => t.teamId);
  if (teamIds.length === 0) {
    return NextResponse.json({});
  }

  const safesToFetch = await db
    .select({ id: safes.id, address: safes.address, network: safes.network })
    .from(safes)
    .where(and(inArray(safes.id, ids), inArray(safes.teamId, teamIds)));

  const results: Record<string, number> = {};
  for (const safe of safesToFetch) {
    try {
      const count = await getPendingCountLive(safe.network, safe.address);
      results[safe.id] = count;
    } catch {
      results[safe.id] = 0;
    }
    if (safesToFetch.indexOf(safe) < safesToFetch.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return NextResponse.json(results);
}
