"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Loader2, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type ItemState = {
  completed: boolean;
  autoResult?: boolean;
  note?: string;
  completedAt?: string;
};

type TemplateItem = {
  id: string;
  label: string;
  type: "auto" | "manual";
  required?: boolean;
};

type ReviewDetail = {
  review: {
    id: string;
    safeId: string;
    safeTxHash: string;
    walletAddress: string | null;
    status: string;
    signingNote: string | null;
    itemsStateJson: Record<string, ItemState> | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  safeName: string | null;
  safeAddress: string;
  network: string;
  classification: string | null;
  reviewerName: string | null;
  reviewerEmail: string;
  templateName: string | null;
  templateItems: TemplateItem[] | null;
};

function buildAttestationLines(
  templateItems: TemplateItem[] | null,
  itemsState: Record<string, ItemState> | null
): Array<{
  id: string;
  label: string;
  type: string;
  state: ItemState | null;
}> {
  const state = itemsState ?? {};
  const byId = new Map((templateItems ?? []).map((t) => [t.id, t]));
  const ids = new Set([...byId.keys(), ...Object.keys(state)]);

  return [...ids].map((id) => {
    const def = byId.get(id);
    return {
      id,
      label: def?.label ?? id,
      type: def?.type ?? "manual",
      state: state[id] ?? null,
    };
  });
}

type ReviewDetailModalProps = {
  reviewId: string | null;
  onClose: () => void;
};

export function ReviewDetailModal({ reviewId, onClose }: ReviewDetailModalProps) {
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reviewId) {
      setDetail(null);
      return;
    }

    setLoading(true);
    setError(null);
    fetch(`/api/org/pending-reviews/${reviewId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Could not load review");
        return r.json();
      })
      .then(setDetail)
      .catch(() => setError("Could not load review details"))
      .finally(() => setLoading(false));
  }, [reviewId]);

  useEffect(() => {
    if (!reviewId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reviewId, onClose]);

  if (!reviewId) return null;

  const lines = detail
    ? buildAttestationLines(detail.templateItems, detail.review.itemsStateJson)
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col rounded-xl border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-detail-title"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
          <h2 id="review-detail-title" className="text-sm font-semibold">
            Signer review record
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4 text-sm">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}

          {detail && !loading && (
            <>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
                <dt className="text-muted-foreground">Safe</dt>
                <dd>
                  <Link
                    href={`/dashboard/safes/${detail.review.safeId}`}
                    className="text-primary hover:underline"
                  >
                    {detail.safeName ?? detail.safeAddress}
                  </Link>
                  <span className="text-muted-foreground ml-1">({detail.network})</span>
                </dd>

                <dt className="text-muted-foreground">Reviewer</dt>
                <dd>
                  {detail.reviewerName ?? detail.reviewerEmail}
                  {detail.reviewerName && (
                    <span className="text-muted-foreground block">{detail.reviewerEmail}</span>
                  )}
                </dd>

                {detail.review.walletAddress && (
                  <>
                    <dt className="text-muted-foreground">Wallet</dt>
                    <dd className="font-mono text-[11px] break-all">{detail.review.walletAddress}</dd>
                  </>
                )}

                <dt className="text-muted-foreground">Tx hash</dt>
                <dd className="font-mono text-[11px] break-all">{detail.review.safeTxHash}</dd>

                <dt className="text-muted-foreground">Checklist</dt>
                <dd>{detail.templateName ?? "—"}</dd>

                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <span
                    className={cn(
                      "capitalize font-medium",
                      detail.review.status === "signed" && "text-emerald-600",
                      detail.review.status === "completed" && "text-primary"
                    )}
                  >
                    {detail.review.status.replace("_", " ")}
                  </span>
                </dd>

                <dt className="text-muted-foreground">Last updated</dt>
                <dd>{new Date(detail.review.updatedAt).toLocaleString()}</dd>

                {detail.review.completedAt && (
                  <>
                    <dt className="text-muted-foreground">Completed</dt>
                    <dd>{new Date(detail.review.completedAt).toLocaleString()}</dd>
                  </>
                )}
              </dl>

              {detail.review.signingNote && (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Signing note</p>
                  <p className="text-sm">{detail.review.signingNote}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-medium mb-2">Checklist attestations</p>
                {lines.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No checklist items recorded.</p>
                ) : (
                  <ul className="space-y-2">
                    {lines.map((line) => {
                      const done = line.state?.completed ?? false;
                      const auto = line.type === "auto";
                      const autoPass = line.state?.autoResult === true;
                      const autoFail = line.state?.autoResult === false;

                      return (
                        <li
                          key={line.id}
                          className="flex gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs"
                        >
                          {auto ? (
                            autoPass ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            ) : autoFail ? (
                              <XCircle className="h-4 w-4 text-destructive shrink-0" />
                            ) : (
                              <MinusCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                            )
                          ) : done ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium leading-snug">{line.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {auto ? "Automated check" : "Manual attestation"}
                              {line.state?.completedAt &&
                                ` · ${new Date(line.state.completedAt).toLocaleString()}`}
                            </p>
                            {line.state?.note && (
                              <p className="text-muted-foreground mt-1 italic">{line.state.note}</p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
