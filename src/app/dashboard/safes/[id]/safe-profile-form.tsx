"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

const CLASSIFICATIONS = [
  { value: "", label: "Auto-infer from balance" },
  { value: "personal", label: "Personal" },
  { value: "operational", label: "Operational" },
  { value: "treasury", label: "Treasury" },
  { value: "protocol_critical", label: "Protocol critical" },
] as const;

export function SafeProfileForm({
  safeId,
  initialClassification,
  initialPurpose,
}: {
  safeId: string;
  initialClassification: string | null;
  initialPurpose: string | null;
}) {
  const [classification, setClassification] = useState(initialClassification ?? "");
  const [purpose, setPurpose] = useState(initialPurpose ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/safes/${safeId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classification: classification || null,
          purpose: purpose.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      setMessage("Profile saved");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="safe-classification" className="block text-xs font-medium mb-1">
          Classification
        </label>
        <select
          id="safe-classification"
          value={classification}
          onChange={(e) => setClassification(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          {CLASSIFICATIONS.map((c) => (
            <option key={c.value || "auto"} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="safe-purpose" className="block text-xs font-medium mb-1">
          Purpose
        </label>
        <textarea
          id="safe-purpose"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          rows={2}
          placeholder="e.g. Protocol treasury — mainnet ops"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Required for treasury and protocol-critical safes (SEAL documentation).
        </p>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {message && <p className="text-xs text-emerald-600">{message}</p>}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
      >
        {loading && <Loader2 className="h-3 w-3 animate-spin" />}
        Save profile
      </button>
    </form>
  );
}
