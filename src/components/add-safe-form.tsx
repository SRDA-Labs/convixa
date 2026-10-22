"use client";

import { useState, useEffect } from "react";
import { SAFE_CHAINS } from "@/lib/safe-api";
import { Loader2 } from "lucide-react";
import type { AddSafeInitialValues } from "./add-safe-modal-provider";

const IMPLEMENTATIONS = [
  { value: "safe", label: "Safe (Gnosis Safe)" },
  { value: "zodiac", label: "Zodiac Module" },
  { value: "roles_v2", label: "Roles v2 Modifier" },
  { value: "hats_signer_gate", label: "Hats Signer Gate" },
  { value: "custom", label: "Custom" },
] as const;

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-colors min-h-[44px]";

export function AddSafeForm({
  onSuccess,
  onCancel,
  initialValues,
}: {
  onSuccess: (safeId: string) => void;
  onCancel?: () => void;
  initialValues?: AddSafeInitialValues;
}) {
  const [teams, setTeams] = useState<{ teamId: string; teamName: string }[]>([]);
  const [teamId, setTeamId] = useState("");
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState("eth");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [implementation, setImplementation] = useState("safe");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then((d) => {
        if (d.teams) setTeams(d.teams);
        if (d.teams?.length && !teamId) setTeamId(d.teams[0].teamId);
      })
      .catch(() => setError("Failed to load teams"));
  }, []);

  useEffect(() => {
    if (!initialValues) return;
    if (initialValues.address !== undefined) setAddress(initialValues.address);
    if (initialValues.network !== undefined) setNetwork(initialValues.network);
    if (initialValues.name !== undefined) setName(initialValues.name);
  }, [initialValues]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/safes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          address: address.trim().toLowerCase(),
          network,
          name: name.trim() || undefined,
          notes: notes.trim() || undefined,
          implementation,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to add Safe");
        return;
      }
      onSuccess(data.safe.id);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="divide-y divide-border">
      <section className="p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="add-safe-team" className="block text-sm font-medium text-foreground mb-1.5">
              Team
            </label>
            <select
              id="add-safe-team"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              required
              className={inputClass}
            >
              <option value="">Select team</option>
              {teams.map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.teamName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="add-safe-network" className="block text-sm font-medium text-foreground mb-1.5">
              Network
            </label>
            <select
              id="add-safe-network"
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              className={inputClass}
            >
              {SAFE_CHAINS.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="add-safe-address" className="block text-sm font-medium text-foreground mb-1.5">
            Safe address
          </label>
          <input
            id="add-safe-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            placeholder="0x..."
            className={`${inputClass} font-mono`}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Ethereum address of the multisig contract.
          </p>
        </div>
      </section>

      <section className="p-6 bg-muted/20">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Optional
        </h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="add-safe-impl" className="block text-sm font-medium text-foreground mb-1.5">
              Implementation
            </label>
            <select
              id="add-safe-impl"
              value={implementation}
              onChange={(e) => setImplementation(e.target.value)}
              className={inputClass}
            >
              {IMPLEMENTATIONS.map((imp) => (
                <option key={imp.value} value={imp.value} disabled={imp.value !== "safe"}>
                  {imp.label}{imp.value !== "safe" ? " (coming soon)" : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Multisig implementation type. Additional providers coming soon.
            </p>
          </div>
          <div>
            <label htmlFor="add-safe-name" className="block text-sm font-medium text-foreground mb-1.5">
              Display name
            </label>
            <input
              id="add-safe-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Treasury – Main"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="add-safe-notes" className="block text-sm font-medium text-foreground mb-1.5">
              Notes
            </label>
            <textarea
              id="add-safe-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Internal notes about this Safe"
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>
      </section>

      {error && (
        <div className="px-6 py-3 bg-destructive/10 border-t border-border">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="px-6 py-4 bg-muted/10 border-t border-border flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={loading || !teamId}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 min-h-[44px]"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
              Adding…
            </>
          ) : (
            "Add Safe"
          )}
        </button>
      </div>
    </form>
  );
}
