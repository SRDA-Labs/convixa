import { NextResponse } from "next/server";
import { requireAuth, validateSafeAccess } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import { getSafeTxServiceBaseUrl, safeApiFetch } from "@/lib/safe-api";

interface BalanceItem {
  symbol: string;
  balance: string;
  decimals: number;
}

/** GET /api/safes/[id]/balance – fetch Safe balances from Safe API (for client fallback when server fetch is empty). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });
  }
  const safeId = parsed.data;

  const safeResult = await validateSafeAccess(safeId);
  if (safeResult instanceof NextResponse) return safeResult;
  const { safe, safeAddress } = safeResult;

  const base = getSafeTxServiceBaseUrl(safe.network);
  const url = `${base}api/v1/safes/${safeAddress}/balances/?trusted=false`;
  let res = await safeApiFetch(url);
  if (!res.ok && res.status === 429) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await safeApiFetch(url);
  }
  if (!res.ok) {
    const hint =
      res.status === 429
        ? " Rate limited — try again in a minute."
        : res.status === 404
          ? " Safe not found or not indexed on this network."
          : "";
    return NextResponse.json(
      { error: `Could not fetch balances from Safe API (${res.status}).${hint}` },
      { status: 502 }
    );
  }

  const raw = await res.json();
  type BalanceEntry = {
    tokenAddress?: string | null;
    token?: { symbol?: string; decimals?: number } | null;
    balance?: string;
  };
  const results: BalanceEntry[] = Array.isArray(raw)
    ? raw
    : (raw?.results ?? raw?.items ?? []);

  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const balances: BalanceItem[] = results.map((r) => {
    const decimals = r.token?.decimals ?? 18;
    const symbol =
      r.token?.symbol ??
      (r.tokenAddress == null ||
      r.tokenAddress === "" ||
      (typeof r.tokenAddress === "string" &&
        r.tokenAddress.toLowerCase() === zeroAddress)
        ? "ETH"
        : "Token");
    const balance = r.balance ?? "0";
    return { symbol, balance, decimals };
  });

  return NextResponse.json({ balances });
}
