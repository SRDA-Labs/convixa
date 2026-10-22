import { eq, inArray, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { safes, pendingTxReviews } from "@/lib/db/schema";
import { getDefaultTeams } from "@/lib/auth-server";
import { fetchSafeInfo, fetchSafePendingTransactions, inferTxCategory, inferTxType } from "@/lib/safe-api";
import {
  getReviewCountsForTx,
  normalizeSafeTxHash,
} from "@/lib/db/repositories/operational-workflows.repository";
import { isDevSimulateEnabled } from "@/lib/signer-queue/dev-simulate";
import { DEV_SIMULATED_SAFE_TX_HASH } from "@/lib/signer-queue/simulated-tx";

export type PendingTxMatrixRow = {
  safeId: string;
  safeName: string | null;
  safeAddress: string;
  network: string;
  classification: string | null;
  safeTxHash: string;
  to: string;
  value: string;
  txType: string;
  txCategory: string;
  submissionDate: string;
  completedReviews: number;
  inProgressReviews: number;
  totalReviews: number;
  isSimulated?: boolean;
};

export async function getOrgPendingTxMatrix(orgId: string): Promise<PendingTxMatrixRow[]> {
  const teams = await getDefaultTeams();
  const teamIds = teams.map((t) => t.teamId);
  if (teamIds.length === 0) return [];

  const safesList = await db
    .select({
      id: safes.id,
      address: safes.address,
      network: safes.network,
      name: safes.name,
      classification: safes.classification,
    })
    .from(safes)
    .where(and(eq(safes.orgId, orgId), inArray(safes.teamId, teamIds)));

  const rows: PendingTxMatrixRow[] = [];

  for (const safe of safesList) {
    try {
      const [info, pendingRaw] = await Promise.all([
        fetchSafeInfo(safe.network, safe.address),
        fetchSafePendingTransactions(safe.network, safe.address),
      ]);
      const currentNonce = info?.nonce ?? 0;
      const pending = pendingRaw.filter((tx) => {
        const txNonce =
          typeof tx.nonce === "string" ? parseInt(tx.nonce, 10) : (tx.nonce ?? 0);
        return txNonce === currentNonce;
      });

      for (const tx of pending) {
        const safeTxHash = tx.safeTxHash;
        if (!safeTxHash) continue;
        const reviewCounts = await getReviewCountsForTx(safe.id, safeTxHash);
        const txDetail = tx as {
          dataDecoded?: { method?: string };
          data?: string;
          operation?: number | string;
        };
        const method = txDetail.dataDecoded?.method;
        const value = tx.value ?? "0";
        const data = txDetail.data ?? "0x";
        const operation = txDetail.operation;
        rows.push({
          safeId: safe.id,
          safeName: safe.name,
          safeAddress: safe.address,
          network: safe.network,
          classification: safe.classification,
          safeTxHash,
          to: tx.to ?? "",
          value,
          txType: inferTxType(method, value, data, operation),
          txCategory: inferTxCategory(method, value, data, operation),
          submissionDate: tx.submissionDate ?? new Date().toISOString(),
          completedReviews: reviewCounts.completed,
          inProgressReviews: reviewCounts.inProgress,
          totalReviews: reviewCounts.total,
        });
      }
    } catch {
      // skip safe on API error
    }
  }

  if (isDevSimulateEnabled() && safesList.length > 0) {
    const safe = safesList[0];
    const already = rows.some((r) => r.safeTxHash === DEV_SIMULATED_SAFE_TX_HASH);
    if (!already) {
      const simCounts = await getReviewCountsForTx(
        safe.id,
        normalizeSafeTxHash(DEV_SIMULATED_SAFE_TX_HASH)
      );
      rows.unshift({
        safeId: safe.id,
        safeName: safe.name,
        safeAddress: safe.address,
        network: safe.network,
        classification: safe.classification,
        safeTxHash: DEV_SIMULATED_SAFE_TX_HASH,
        to: "0x544Bb3E325E8139237518B3882b5899399b2A683",
        value: "100000000000000000",
        txType: "Native transfer",
        txCategory: "NATIVE_TRANSFER",
        submissionDate: new Date().toISOString(),
        completedReviews: simCounts.completed,
        inProgressReviews: simCounts.inProgress,
        totalReviews: simCounts.total,
        isSimulated: true,
      });
    }
  }

  return rows.sort(
    (a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()
  );
}
