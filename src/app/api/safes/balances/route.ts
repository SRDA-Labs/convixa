import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAddress } from "viem";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { safes } from "@/lib/db/schema";
import { and, inArray } from "drizzle-orm";
import { getDefaultTeams } from "@/lib/auth-server";
import { getSafeTxServiceBaseUrl, safeApiFetch } from "@/lib/safe-api";

const MAX_IDS = 25;

/** GET /api/safes/balances?ids=id1,id2,... – batch fetch native balance for safes (client-side, off critical path). */
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
  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_IDS);
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

  const results: Record<string, { symbol: string; balance: string; decimals: number } | null> = {};
  await Promise.all(
    safesToFetch.map(async (safe) => {
      try {
        const safeAddress = getAddress(safe.address);
        const base = getSafeTxServiceBaseUrl(safe.network);
        const url = `${base}api/v1/safes/${safeAddress}/balances/?trusted=false`;
        const res = await safeApiFetch(url, {
          cache: "force-cache",
          next: { revalidate: 60 },
        });
        if (!res.ok) {
          results[safe.id] = null;
          return;
        }
        const raw = await res.json();
        type BalanceEntry = {
          tokenAddress?: string | null;
          token?: { symbol?: string; decimals?: number } | null;
          balance?: string;
        };
        const list: BalanceEntry[] = Array.isArray(raw)
          ? raw
          : (raw?.results ?? raw?.items ?? []);
        const zero = "0x0000000000000000000000000000000000000000";
        const native =
          list.find(
            (r) =>
              r.tokenAddress == null ||
              r.tokenAddress === "" ||
              (typeof r.tokenAddress === "string" && r.tokenAddress.toLowerCase() === zero) ||
              r.token?.symbol === "ETH" ||
              !r.token
          ) ?? list[0];
        if (!native) {
          results[safe.id] = null;
          return;
        }
        results[safe.id] = {
          symbol: native.token?.symbol ?? "ETH",
          balance: native.balance ?? "0",
          decimals: native.token?.decimals ?? 18,
        };
      } catch {
        results[safe.id] = null;
      }
    })
  );

  return NextResponse.json(results);
}
