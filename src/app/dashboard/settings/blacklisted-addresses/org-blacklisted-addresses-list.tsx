"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";

type BlacklistedAddress = {
  id: string;
  address: string;
  createdAt: string;
};

export function OrgBlacklistedAddressesList() {
  const [addresses, setAddresses] = useState<BlacklistedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const router = useRouter();

  function fetchAddresses() {
    return fetch("/api/org/blacklisted-addresses")
      .then((r) => r.json())
      .then((d) => {
        if (d.addresses) setAddresses(d.addresses);
      })
      .catch(() => setAddresses([]));
  }

  useEffect(() => {
    fetchAddresses().finally(() => setLoading(false));
  }, []);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const raw = input.trim();
    if (!raw) return;
    const addressList = raw
      .split(/[\n,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (addressList.length === 0) {
      setError("Enter one or more Ethereum addresses.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/org/blacklisted-addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: addressList }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to add");
        return;
      }
      setSuccess(`Added ${data.added ?? 0} address(es). Invalid addresses were skipped.`);
      setInput("");
      fetchAddresses();
      router.refresh();
    });
  }

  function handleRemoveClick(id: string) {
    setRemoveConfirmId(id);
  }

  async function handleRemoveConfirm() {
    const id = removeConfirmId;
    if (!id) return;
    setError("");
    setSuccess("");
    setRemovingId(id);
    try {
      const r = await fetch(`/api/org/blacklisted-addresses/${id}`, { method: "DELETE" });
      const data = await r.json().catch(() => ({}));
      if (!data.error) {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
        setSuccess("Address removed.");
      } else {
        setError(data.error);
      }
    } finally {
      setRemovingId(null);
      setRemoveConfirmId(null);
    }
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="addresses" className="block text-sm font-medium mb-1">
            Add address(es)
          </label>
          <textarea
            id="addresses"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="0x… or paste list (one per line)"
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            disabled={isPending}
          />
        </div>
        <button
          type="submit"
          disabled={isPending || !input.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600 dark:text-green-400">{success}</p>}

      <div>
        <h3 className="text-sm font-medium mb-2">Org blacklist ({addresses.length})</h3>
        {addresses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No addresses. Add addresses above; pending txs to these (or the global blacklist) can trigger the destination blacklist alert.</p>
        ) : (
          <ul className="border border-border rounded-md divide-y divide-border">
            {addresses.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-3 py-2">
                <span className="font-mono text-sm break-all">{a.address}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveClick(a.id)}
                  disabled={removingId !== null}
                  className="p-1.5 text-muted-foreground hover:text-destructive rounded shrink-0"
                  aria-label={`Remove ${a.address}`}
                >
                  {removingId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={removeConfirmId !== null}
        onClose={() => setRemoveConfirmId(null)}
        onConfirm={handleRemoveConfirm}
        title="Remove from blacklist?"
        description="This address will no longer trigger the destination blacklist alert for your org."
        destructive
      />
    </div>
  );
}
