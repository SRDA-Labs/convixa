"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
type ModuleEntry = { address: string; name?: string };

export function SecurityAttachments({
  safeId,
  network,
  guardAddress,
  fallbackHandler,
  modules,
  moduleExceptionNote,
  canEdit,
}: {
  safeId: string;
  network: string;
  guardAddress: string | null;
  fallbackHandler: string | null;
  modules: ModuleEntry[];
  moduleExceptionNote: string | null;
  canEdit: boolean;
}) {
  const [note, setNote] = useState(moduleExceptionNote ?? "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const needsJustification = modules.length > 0 && !note.trim();

  function explorerAddr(addr: string) {
    const base: Record<string, string> = {
      eth: "https://etherscan.io/address",
      base: "https://basescan.org/address",
      arbitrum: "https://arbiscan.io/address",
      polygon: "https://polygonscan.com/address",
      optimism: "https://optimistic.etherscan.io/address",
    };
    return `${base[network] ?? "https://etherscan.io/address"}/${addr}`;
  }

  async function saveNote() {
    setLoading(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/safes/${safeId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleExceptionNote: note.trim() || null }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 text-xs">
      {needsJustification && (
        <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p>
            SEAL recommends avoiding modules unless justified and security-reviewed. Document why
            these modules are enabled.
          </p>
        </div>
      )}
      <dl className="space-y-2">
        <div>
          <dt className="text-muted-foreground">Guard</dt>
          <dd className="font-mono break-all">
            {guardAddress ? (
              <a href={explorerAddr(guardAddress)} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                {guardAddress}
              </a>
            ) : (
              "None"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Fallback handler</dt>
          <dd className="font-mono break-all">
            {fallbackHandler ? (
              <a href={explorerAddr(fallbackHandler)} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                {fallbackHandler}
              </a>
            ) : (
              "None"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Modules ({modules.length})</dt>
          <dd>
            {modules.length === 0 ? (
              "None enabled"
            ) : (
              <ul className="mt-1 space-y-1">
                {modules.map((m) => (
                  <li key={m.address} className="font-mono">
                    <a href={explorerAddr(m.address)} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                      {m.name ? `${m.name} · ` : ""}
                      {m.address.slice(0, 10)}…{m.address.slice(-6)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
      {canEdit && modules.length > 0 && (
        <div>
          <label className="block text-muted-foreground mb-1">Module exception note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs resize-none"
            placeholder="Security review reference and purpose of modules…"
          />
          <button
            type="button"
            onClick={saveNote}
            disabled={loading}
            className="mt-2 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted/50 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            Save note
          </button>
          {saved && <span className="ml-2 text-emerald-600">Saved</span>}
        </div>
      )}
    </div>
  );
}
