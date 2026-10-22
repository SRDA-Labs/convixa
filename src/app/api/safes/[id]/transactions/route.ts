import { NextRequest, NextResponse } from "next/server";
import { requireAuth, validateSafeAccess } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import { getSafeTxServiceBaseUrl, inferTxType, safeApiFetch } from "@/lib/safe-api";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

interface SafeTxItem {
  safeTxHash: string;
  transactionHash: string | null;
  to: string;
  value: string;
  submissionDate: string;
  executedAt: string | null;
  txType: string;
}

/** GET /api/safes/[id]/transactions?limit=10&offset=0 – paginated executed transactions. */
export async function GET(
  req: NextRequest,
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

  const limit = Math.min(
    Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)),
    MAX_LIMIT
  );
  const offset = Math.max(0, parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10));

  const base = getSafeTxServiceBaseUrl(safe.network);
  type TxRow = {
    safeTxHash?: string;
    transactionHash?: string | null;
    to?: string;
    value?: string;
    data?: string | null;
    submissionDate?: string;
    executedAt?: string | null;
    executionDate?: string | null;
    dataDecoded?: { method?: string } | null;
  };
  function parseList(raw: unknown): TxRow[] {
    if (Array.isArray(raw)) return raw as TxRow[];
    if (raw && typeof raw === "object" && "results" in raw) return (raw as { results?: TxRow[] }).results ?? [];
    if (raw && typeof raw === "object" && "transactions" in raw) return (raw as { transactions?: TxRow[] }).transactions ?? [];
    if (raw && typeof raw === "object" && "items" in raw) return (raw as { items?: TxRow[] }).items ?? [];
    return [];
  }
  let list: TxRow[] = [];
  const fetchLimit = limit + 1;
  const urlWithExecuted = `${base}api/v1/safes/${safeAddress}/multisig-transactions/?executed=true&limit=${fetchLimit}&offset=${offset}`;
  let res = await safeApiFetch(urlWithExecuted);
  if (!res.ok && res.status === 429) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await safeApiFetch(urlWithExecuted);
  }
  if (res.ok) {
    const raw = await res.json();
    list = parseList(raw);
  }
  // Fallback: if executed=true returns empty, fetch without filter and keep only executed (have transactionHash)
  if (list.length === 0) {
    const urlAll = `${base}api/v1/safes/${safeAddress}/multisig-transactions/?limit=${limit + 50}&offset=${offset}`;
    let resAll = await safeApiFetch(urlAll);
    if (!resAll.ok && resAll.status === 429) {
      await new Promise((r) => setTimeout(r, 1500));
      resAll = await safeApiFetch(urlAll);
    }
    if (resAll.ok) {
      const rawAll = await resAll.json();
      const all = parseList(rawAll);
      list = all.filter((t) => t.transactionHash ?? t.executionDate ?? t.executedAt);
    }
  }
  if (list.length === 0 && !res.ok) {
    const hint =
      res.status === 429
        ? " Rate limited — try again in a minute."
        : res.status === 404
          ? " Safe not found or not indexed on this network."
          : "";
    return NextResponse.json(
      { error: `Could not fetch transactions from Safe API (${res.status}).${hint}` },
      { status: 502 }
    );
  }
  const hasMore = list.length > limit;
  const transactions: SafeTxItem[] = list
    .map((t) => {
      const value = t.value ?? "0";
      const dataPayload = t.data ?? "";
      const method = t.dataDecoded?.method;
      const txType = inferTxType(method, value, dataPayload);
      return {
        safeTxHash: t.safeTxHash ?? "",
        transactionHash: t.transactionHash ?? null,
        to: t.to ?? "",
        value,
        submissionDate: t.submissionDate ?? "",
        executedAt: t.executedAt ?? t.executionDate ?? null,
        txType,
      };
    })
    .sort((a, b) => {
      const dateA = a.executedAt ?? a.submissionDate ?? "";
      const dateB = b.executedAt ?? b.submissionDate ?? "";
      return dateB.localeCompare(dateA);
    })
    .slice(0, limit);

  return NextResponse.json({ transactions, hasMore });
}
