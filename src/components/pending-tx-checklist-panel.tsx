"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2, ExternalLink, ClipboardCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

type ChecklistItem = {
  id: string;
  label: string;
  type: "auto" | "manual";
  required?: boolean;
  applicable?: boolean;
  autoResult?: boolean | null;
  autoMessage?: string;
  autoSeverity?: "pass" | "warn" | "fail";
  autoAction?: { href: string; label: string };
};

export type ChecklistSaveResult = {
  status: string;
  isComplete: boolean;
};

type ChecklistPanelProps = {
  safeId: string;
  safeTxHash: string;
  to: string;
  value: string;
  txCategory: string;
  safeAppUrl?: string;
  onClose?: () => void;
  onSaved?: (result: ChecklistSaveResult) => void;
  /** When false, hide the panel header close control (e.g. parent modal provides dismiss). */
  showCloseControl?: boolean;
};

export function PendingTxChecklistPanel({
  safeId,
  safeTxHash,
  to,
  value,
  txCategory,
  safeAppUrl,
  onClose,
  onSaved,
  showCloseControl = true,
}: ChecklistPanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [itemsState, setItemsState] = useState<Record<string, { completed: boolean; note?: string }>>({});
  const [status, setStatus] = useState<string>("in_progress");
  const [signingNote, setSigningNote] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ to, value, txCategory });
    const res = await fetch(
      `/api/safes/${safeId}/pending/${encodeURIComponent(safeTxHash)}/checklist?${params}`
    );
    if (!res.ok) {
      setError("Could not load checklist");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setItems(data.items ?? []);
    setTemplateName(data.template?.name ?? null);
    if (data.myReview) {
      setItemsState((data.myReview.itemsState as typeof itemsState) ?? {});
      setStatus(data.myReview.status ?? "in_progress");
      setSigningNote(data.myReview.signingNote ?? "");
      setIsComplete(data.myReview.isComplete ?? false);
    }
    setLoading(false);
  }, [safeId, safeTxHash, to, value, txCategory]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveReview() {
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    const res = await fetch(
      `/api/safes/${safeId}/pending/${encodeURIComponent(safeTxHash)}/checklist`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, value, txCategory, itemsState }),
      }
    );
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Save failed");
      setSaving(false);
      return;
    }
    const data = await res.json();
    const nextComplete = data.isComplete ?? data.review?.status === "completed";
    const nextStatus = data.status ?? data.review?.status ?? status;
    setIsComplete(nextComplete);
    setStatus(nextStatus);
    setSaving(false);
    setSaveMessage(
      nextComplete
        ? "Checklist complete — saved"
        : "Progress saved — finish required items to complete"
    );
    onSaved?.({ status: nextStatus, isComplete: nextComplete });
    if (onClose) {
      window.setTimeout(() => onClose(), 600);
    }
  }

  async function markSigned() {
    setSaving(true);
    await fetch(`/api/safes/${safeId}/pending/${encodeURIComponent(safeTxHash)}/checklist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "signed", signingNote: signingNote || null }),
    });
    setStatus("signed");
    setSaving(false);
    onSaved?.({ status: "signed", isComplete: true });
    if (onClose) onClose();
  }

  function toggleManual(id: string) {
    setItemsState((prev) => ({
      ...prev,
      [id]: { ...prev[id], completed: !prev[id]?.completed },
    }));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!templateName && items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No checklist template matches this transaction type.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {showCloseControl && (
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              {templateName ?? "Pre-sign checklist"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Complete required items before signing in Safe App
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          )}
        </div>
      )}

      {!showCloseControl && templateName && (
        <p className="text-xs text-muted-foreground -mt-1">
          {templateName} — complete required items before signing in Safe App
        </p>
      )}

      <ul className="space-y-2">
        {items
          .filter((item) => item.applicable !== false)
          .map((item) => (
            <li
              key={item.id}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs",
                item.type === "auto" && item.autoSeverity === "fail"
                  ? "border-destructive/40 bg-destructive/5"
                  : item.type === "auto" && item.autoSeverity === "warn"
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-border/80"
              )}
            >
              <div className="flex items-start gap-2">
                {item.type === "auto" ? (
                  item.autoSeverity === "warn" ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : item.autoResult === true ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : item.autoResult === false ? (
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <span className="h-4 w-4 shrink-0" />
                  )
                ) : (
                  <input
                    type="checkbox"
                    checked={itemsState[item.id]?.completed ?? false}
                    onChange={() => toggleManual(item.id)}
                    className="mt-0.5"
                  />
                )}
                <div>
                  <span className="font-medium">{item.label}</span>
                  {item.required && (
                    <span className="text-muted-foreground ml-1">(required)</span>
                  )}
                  {item.autoMessage && (
                    <p
                      className={cn(
                        "mt-0.5",
                        item.autoSeverity === "warn"
                          ? "text-amber-700 dark:text-amber-400"
                          : item.autoSeverity === "fail"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      )}
                    >
                      {item.autoMessage}
                    </p>
                  )}
                  {item.autoAction && (
                    <Link
                      href={item.autoAction.href}
                      className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-primary hover:underline"
                    >
                      {item.autoAction.label}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
      </ul>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {saveMessage && (
        <p
          className={cn(
            "text-xs font-medium rounded-md px-2.5 py-1.5",
            isComplete
              ? "bg-emerald-500/10 text-emerald-700"
              : "bg-primary/10 text-primary"
          )}
        >
          {saveMessage}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveReview}
          disabled={saving}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save review"}
        </button>
        {isComplete && status !== "signed" && (
          <>
            <input
              type="text"
              placeholder="Signing note (e.g. signed, 2 more required)"
              value={signingNote}
              onChange={(e) => setSigningNote(e.target.value)}
              className="flex-1 min-w-[180px] rounded-md border border-border px-2 py-1.5 text-xs"
            />
            <button
              type="button"
              onClick={markSigned}
              disabled={saving}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
            >
              Mark signed
            </button>
          </>
        )}
        {safeAppUrl && (
          <a
            href={safeAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium",
              isComplete
                ? "border-primary text-primary hover:bg-primary/5"
                : "border-border text-muted-foreground pointer-events-none opacity-50"
            )}
            aria-disabled={!isComplete}
          >
            Open in Safe
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
