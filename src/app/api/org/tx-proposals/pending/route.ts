import { NextResponse } from "next/server";
import { eq, inArray, and } from "drizzle-orm";
import { requireAuthAndOrg } from "@/lib/api-helpers";
import { getDefaultTeams } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { safes } from "@/lib/db/schema";
import {
  fetchSafeInfo,
  fetchSafePendingTransactions,
  inferTxCategory,
  inferTxType,
} from "@/lib/safe-api";
import { getTxThreadHashesForSafes } from "@/lib/db/repositories/tx-proposals.repository";
import { normalizeSafeTxHash } from "@/lib/db/repositories/operational-workflows.repository";

export type PendingWithoutDiscussion = {
  safeId: string;
  safeName: string | null;
  safeAddress: string;
  network: string;
  teamId: string;
  safeTxHash: string;
  txType: string;
  txCategory: string;
  submissionDate: string;
  to: string;
  value: string;
};

/** Pending txs on team safes that do not yet have a discussion thread. */
export async function GET(req: Request) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const teamIdFilter = url.searchParams.get("teamId")?.trim() || undefined;

  const userTeams = await getDefaultTeams();
  let teamIds = userTeams.map((t) => t.teamId);
  if (teamIdFilter) {
    teamIds = teamIds.includes(teamIdFilter) ? [teamIdFilter] : [];
  }
  if (teamIds.length === 0) {
    return NextResponse.json({ pending: [] });
  }

  const safesList = await db
    .select({
      id: safes.id,
      address: safes.address,
      network: safes.network,
      name: safes.name,
      teamId: safes.teamId,
    })
    .from(safes)
    .where(and(eq(safes.orgId, auth.orgId), inArray(safes.teamId, teamIds)));

  const safeIds = safesList.map((s) => s.id);
  const threadKeys = await getTxThreadHashesForSafes(safeIds);

  const pending: PendingWithoutDiscussion[] = [];

  for (const safe of safesList) {
    try {
      const [info, pendingRaw] = await Promise.all([
        fetchSafeInfo(safe.network, safe.address),
        fetchSafePendingTransactions(safe.network, safe.address),
      ]);
      const currentNonce = info?.nonce ?? 0;
      const nonceNum =
        typeof currentNonce === "string" ? parseInt(currentNonce, 10) : currentNonce;

      const atNonce = pendingRaw.filter((tx) => {
        const n = tx.nonce;
        const txNonce = typeof n === "string" ? parseInt(n, 10) : (n ?? 0);
        return txNonce === nonceNum;
      });

      for (const tx of atNonce) {
        const hash = tx.safeTxHash;
        if (!hash) continue;
        const normalized = normalizeSafeTxHash(hash);
        const key = `${safe.id}:${normalized}`;
        if (threadKeys.has(key)) continue;

        const value = tx.value ?? "0";
        const data = (tx as { data?: string }).data ?? "0x";
        const method = (tx as { dataDecoded?: { method?: string } }).dataDecoded?.method;
        const operation = (tx as { operation?: number | string }).operation;

        pending.push({
          safeId: safe.id,
          safeName: safe.name,
          safeAddress: safe.address,
          network: safe.network,
          teamId: safe.teamId,
          safeTxHash: normalized,
          txType: inferTxType(method, value, data, operation),
          txCategory: inferTxCategory(method, value, data, operation),
          submissionDate: tx.submissionDate ?? new Date().toISOString(),
          to: tx.to ?? "",
          value,
        });
      }
    } catch {
      // skip safe on API failure
    }
  }

  pending.sort(
    (a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()
  );

  return NextResponse.json({ pending });
}
