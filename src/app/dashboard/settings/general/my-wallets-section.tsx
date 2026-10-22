"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Star, Trash2, Check, Loader2, Pencil, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface WalletLink {
  id: string;
  wallet_address: string;
  label: string | null;
  is_primary: boolean;
  verified_at: string | null;
  verification_method: string;
  created_at: string;
}

function truncateAddress(addr: string, start = 8, end = 6): string {
  if (addr.length <= start + end) return addr;
  return `${addr.slice(0, start)}…${addr.slice(-end)}`;
}

export function MyWalletsSection() {
  const router = useRouter();
  const [wallets, setWallets] = useState<WalletLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchWallets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile/wallets");
      if (!res.ok) throw new Error("Failed to load wallets");
      const data = await res.json();
      setWallets(data.wallets ?? []);
    } catch {
      setError("Could not load your wallets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  async function handleSetPrimary(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/profile/wallets/${id}/primary`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      await fetchWallets();
      router.refresh();
    } catch {
      setError("Could not set primary wallet.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveLabel(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/profile/wallets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: editLabel.trim() || null }),
      });
      if (!res.ok) throw new Error("Failed");
      setEditingId(null);
      await fetchWallets();
    } catch {
      setError("Could not update label.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    setRemoving(true);
    try {
      const res = await fetch(`/api/profile/wallets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setRemovingId(null);
      await fetchWallets();
      router.refresh();
    } catch {
      setError("Could not remove wallet.");
    } finally {
      setRemoving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {wallets.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No wallets linked yet. Connect a wallet in the Linked Wallet section above.
        </p>
      ) : (
        <ul className="space-y-2">
          {wallets.map((w) => (
            <li
              key={w.id}
              className="rounded-md border border-border bg-muted/30 overflow-hidden"
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                {/* Status dot + primary indicator */}
                <span
                  className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                  aria-hidden
                />

                {/* Address + label */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-foreground truncate">
                      {truncateAddress(w.wallet_address)}
                    </code>
                    {w.is_primary && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0 text-[10px] font-medium text-primary shrink-0">
                        <Star className="h-2.5 w-2.5" />
                        PRIMARY
                      </span>
                    )}
                  </div>

                  {/* Label display / edit */}
                  {editingId === w.id ? (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        placeholder="e.g. Ledger, Metamask"
                        maxLength={64}
                        className="flex-1 text-[11px] bg-background border border-border rounded px-2 py-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 min-h-[32px]"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveLabel(w.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveLabel(w.id)}
                        disabled={saving}
                        className="p-1.5 rounded text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-50 min-h-[32px] min-w-[32px] flex items-center justify-center"
                        aria-label="Save label"
                      >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground min-h-[32px] min-w-[32px] flex items-center justify-center"
                        aria-label="Cancel editing"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {w.label || "No label"}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {editingId !== w.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(w.id);
                        setEditLabel(w.label ?? "");
                        setError("");
                      }}
                      className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 min-h-[32px] min-w-[32px] flex items-center justify-center"
                      aria-label="Edit label"
                      title="Edit label"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {!w.is_primary && editingId !== w.id && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(w.id)}
                      disabled={saving}
                      className="p-1.5 rounded text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 disabled:opacity-50 min-h-[32px] min-w-[32px] flex items-center justify-center"
                      aria-label="Set as primary"
                      title="Set as primary"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {editingId !== w.id && (
                    <button
                      type="button"
                      onClick={() => setRemovingId(w.id)}
                      className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 min-h-[32px] min-w-[32px] flex items-center justify-center"
                      aria-label="Remove wallet"
                      title="Remove wallet"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Remove confirmation dialog */}
      <ConfirmDialog
        open={removingId !== null}
        onClose={() => setRemovingId(null)}
        title="Remove linked wallet?"
        description="This wallet will be removed from your profile. You can re-link it later."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={() => { if (removingId) void handleRemove(removingId); }}
        destructive
        loading={removing}
      />
    </div>
  );
}
