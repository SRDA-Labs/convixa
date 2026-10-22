"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Download, MessageSquare } from "lucide-react";
import { DEV_SIMULATED_SAFE_TX_HASH } from "@/lib/signer-queue/simulated-tx";
import { ReviewDetailModal } from "./review-detail-modal";

type ReviewRow = {
  review: {
    id: string;
    safeId: string;
    safeTxHash: string;
    status: string;
    signingNote: string | null;
    updatedAt: string;
  };
  safeName: string | null;
  safeAddress: string;
  network: string;
  classification: string | null;
};

type PendingTxRow = {
  safeId: string;
  safeName: string | null;
  safeAddress: string;
  network: string;
  classification: string | null;
  safeTxHash: string;
  txType: string;
  submissionDate: string;
  completedReviews: number;
  inProgressReviews?: number;
  totalReviews?: number;
  isSimulated?: boolean;
};

export function PendingReviewsClient() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [pendingTxs, setPendingTxs] = useState<PendingTxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/org/pending-reviews")
      .then((r) => (r.ok ? r.json() : { reviews: [], pendingTxs: [] }))
      .then((d) => {
        setReviews(d.reviews ?? []);
        setPendingTxs(d.pendingTxs ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <a
          href="/api/org/pending-reviews-export?format=csv"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </a>
      </div>

      {pendingTxs.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Pending transactions</h2>
          <p className="text-xs text-muted-foreground">
            Live pending txs across org safes. Complete checklists in Signer Queue.
          </p>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Safe</th>
                  <th className="text-left font-medium px-3 py-2">Type</th>
                  <th className="text-left font-medium px-3 py-2">Reviews</th>
                  <th className="text-left font-medium px-3 py-2">Submitted</th>
                  <th className="text-right font-medium px-3 py-2">Discuss</th>
                </tr>
              </thead>
              <tbody>
                {pendingTxs.map((tx) => (
                  <tr key={`${tx.safeId}-${tx.safeTxHash}`} className="border-t border-border/50 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <Link href={`/dashboard/safes/${tx.safeId}`} className="text-primary hover:underline">
                        {tx.safeName ?? tx.safeAddress.slice(0, 10) + "…"}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {tx.txType}
                      {(tx.isSimulated || tx.safeTxHash === DEV_SIMULATED_SAFE_TX_HASH) && (
                        <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          Simulated
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {tx.totalReviews != null && tx.totalReviews > 0 ? (
                        <span className="text-foreground">
                          {tx.completedReviews > 0 && (
                            <span className="text-emerald-600">{tx.completedReviews} completed</span>
                          )}
                          {(tx.inProgressReviews ?? 0) > 0 && (
                            <span
                              className={
                                tx.completedReviews > 0
                                  ? "text-muted-foreground ml-1"
                                  : "text-amber-600"
                              }
                            >
                              {tx.completedReviews > 0 ? "· " : ""}
                              {tx.inProgressReviews} in progress
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-amber-600">No reviews</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(tx.submissionDate).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/dashboard/safes/${tx.safeId}/pending/${encodeURIComponent(tx.safeTxHash)}/discussion`}
                        className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Discuss
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h2 className="text-sm font-semibold pt-2">Signer reviews</h2>
      <p className="text-xs text-muted-foreground">
        Click a row to view the full checklist attestation record.
      </p>

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No signer reviews recorded yet. Complete checklists from the Signer Queue.
        </p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Safe</th>
                <th className="text-left font-medium px-3 py-2">Classification</th>
                <th className="text-left font-medium px-3 py-2">Tx hash</th>
                <th className="text-left font-medium px-3 py-2">Status</th>
                <th className="text-left font-medium px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr
                  key={r.review.id}
                  className="border-t border-border/50 hover:bg-muted/20 cursor-pointer"
                  onClick={() => setSelectedReviewId(r.review.id)}
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/dashboard/safes/${r.review.safeId}`}
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.safeName ?? r.safeAddress.slice(0, 10) + "…"}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.classification ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">
                    {r.review.safeTxHash.slice(0, 10)}…
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        r.review.status === "signed"
                          ? "text-emerald-600"
                          : r.review.status === "completed"
                            ? "text-primary"
                            : "text-muted-foreground"
                      }
                    >
                      {r.review.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(r.review.updatedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ReviewDetailModal
        reviewId={selectedReviewId}
        onClose={() => setSelectedReviewId(null)}
      />
    </div>
  );
}
