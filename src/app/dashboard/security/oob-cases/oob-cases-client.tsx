"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Download } from "lucide-react";
import { cn } from "@/lib/cn";

type OobRow = {
  oobCase: {
    id: string;
    safeId: string;
    status: string;
    caseType: string;
    title: string;
    safeTxHash: string | null;
    dueAt: string | null;
    createdAt: string;
  };
  safeName: string | null;
  safeAddress: string;
};

function statusClass(status: string): string {
  if (status === "verified") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (status === "rejected" || status === "expired") return "bg-destructive/10 text-destructive";
  if (status === "pending_confirmations") return "bg-primary/10 text-primary";
  return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
}

export function OobCasesClient() {
  const [cases, setCases] = useState<OobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    case: OobRow["oobCase"];
    evidence: Array<{ channel: string; evidenceType: string; evidenceValue: string }>;
    confirmations: Array<{ confirmationText: string | null }>;
  } | null>(null);
  const [evidenceChannel, setEvidenceChannel] = useState("video_call");
  const [evidenceValue, setEvidenceValue] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/org/oob-cases")
      .then((r) => (r.ok ? r.json() : { cases: [] }))
      .then((d) => {
        setCases(d.cases ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function loadDetail(caseId: string) {
    fetch(`/api/oob-cases/${caseId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setDetail)
      .catch(() => setDetail(null));
  }

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    loadDetail(selected);
  }, [selected]);

  async function submitEvidence() {
    if (!selected || !evidenceValue.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/oob-cases/${selected}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: evidenceChannel,
        evidenceType: "text",
        evidenceValue: evidenceValue.trim(),
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      setEvidenceValue("");
      loadDetail(selected);
    }
  }

  async function submitConfirmation() {
    if (!selected) return;
    setSubmitting(true);
    const res = await fetch(`/api/oob-cases/${selected}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmationText: confirmText.trim() || "Confirmed via Convixa",
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      setConfirmText("");
      loadDetail(selected);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex justify-end">
          <a
            href="/api/org/oob-cases-export?format=csv"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>
        </div>

        {cases.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No OOB cases yet. Cases auto-open for governance proposals on treasury safes.
          </p>
        ) : (
          <ul className="space-y-2">
            {cases.map((c) => (
              <li key={c.oobCase.id}>
                <button
                  type="button"
                  onClick={() => setSelected(c.oobCase.id)}
                  className={cn(
                    "w-full text-left rounded-lg border px-3 py-2 text-xs transition-colors",
                    selected === c.oobCase.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{c.oobCase.title}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", statusClass(c.oobCase.status))}>
                      {c.oobCase.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    <Link href={`/dashboard/safes/${c.oobCase.safeId}`} className="hover:underline">
                      {c.safeName ?? c.safeAddress.slice(0, 10) + "…"}
                    </Link>
                    {" · "}
                    {c.oobCase.caseType.replace(/_/g, " ")}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {detail && (
        <div className="rounded-xl border border-border p-4 space-y-3 text-xs">
          <h3 className="font-semibold">{detail.case.title}</h3>
          <p className="text-muted-foreground">Status: {detail.case.status}</p>
          {detail.case.dueAt && (
            <p className="text-muted-foreground">
              Due: {new Date(detail.case.dueAt).toLocaleString()}
            </p>
          )}
          <div>
            <h4 className="font-medium mb-1">Evidence</h4>
            {detail.evidence.length === 0 ? (
              <p className="text-muted-foreground">No evidence submitted</p>
            ) : (
              <ul className="space-y-1">
                {detail.evidence.map((e, i) => (
                  <li key={i} className="rounded border border-border/60 px-2 py-1">
                    <span className="font-medium">{e.channel}</span>: {e.evidenceValue.slice(0, 80)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="font-medium mb-1">Confirmations ({detail.confirmations.length})</h4>
            {detail.confirmations.length === 0 ? (
              <p className="text-muted-foreground">Awaiting signer confirmations</p>
            ) : (
              <ul className="space-y-1">
                {detail.confirmations.map((c, i) => (
                  <li key={i}>{c.confirmationText ?? "Confirmed"}</li>
                ))}
              </ul>
            )}
            {detail.case.status !== "verified" && detail.case.status !== "rejected" && (
              <div className="mt-2 flex gap-2">
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Confirmation note (optional)"
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={submitConfirmation}
                  disabled={submitting}
                  className="rounded-md bg-primary text-primary-foreground px-2 py-1 text-xs disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            )}
          </div>

          {detail.case.status !== "verified" && detail.case.status !== "rejected" && (
            <div className="pt-2 border-t border-border/60">
              <h4 className="font-medium mb-2">Add evidence</h4>
              <select
                value={evidenceChannel}
                onChange={(e) => setEvidenceChannel(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mb-2"
              >
                <option value="video_call">Video call</option>
                <option value="secondary_messenger">Secondary messenger</option>
                <option value="signed_message">Signed message</option>
                <option value="other">Other</option>
              </select>
              <textarea
                value={evidenceValue}
                onChange={(e) => setEvidenceValue(e.target.value)}
                placeholder="Link, transcript excerpt, or verification notes"
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mb-2"
              />
              <button
                type="button"
                onClick={submitEvidence}
                disabled={submitting || !evidenceValue.trim()}
                className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted/50 disabled:opacity-50"
              >
                Submit evidence
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
