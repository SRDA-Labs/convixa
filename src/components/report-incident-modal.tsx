"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

type ReportIncidentModalProps = {
  open: boolean;
  onClose: () => void;
  prefill?: {
    safeId?: string;
    signerAddress?: string;
    safeTxHash?: string;
  };
};

export function ReportIncidentModal({ open, onClose, prefill }: ReportIncidentModalProps) {
  const [incidentType, setIncidentType] = useState("key_compromise");
  const [severity, setSeverity] = useState("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/org/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        incidentType,
        severity,
        title,
        description,
        affectedSafeIds: prefill?.safeId ? [prefill.safeId] : [],
        affectedSignerAddresses: prefill?.signerAddress ? [prefill.signerAddress] : [],
        linkedSafeTxHash: prefill?.safeTxHash,
      }),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to report incident");
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
    setTimeout(() => {
      onClose();
      setSuccess(false);
      setTitle("");
      setDescription("");
    }, 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Report security incident
          </h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {success ? (
            <p className="text-sm text-emerald-600">Incident reported. Admins have been notified.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  <span className="text-muted-foreground">Type</span>
                  <select
                    value={incidentType}
                    onChange={(e) => setIncidentType(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-xs"
                  >
                    <option value="key_compromise">Key compromise</option>
                    <option value="key_loss">Key loss</option>
                    <option value="suspicious_tx">Suspicious transaction</option>
                    <option value="comms_compromise">Comms compromise</option>
                    <option value="oob_failure">OOB failure</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="text-xs">
                  <span className="text-muted-foreground">Severity</span>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-xs"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
              </div>
              <label className="text-xs block">
                <span className="text-muted-foreground">Title</span>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-xs"
                  placeholder="Brief summary"
                />
              </label>
              <label className="text-xs block">
                <span className="text-muted-foreground">
                  Description <span className="text-muted-foreground/60">(optional)</span>
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-xs"
                  placeholder="Brief notes, or add full details on the tracking page after filing"
                />
              </label>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-destructive px-3 py-2 text-xs font-medium text-destructive-foreground disabled:opacity-50"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Submitting…
                  </span>
                ) : (
                  "Report incident"
                )}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
