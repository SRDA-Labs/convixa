"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RefreshButton({ safeId }: { safeId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/safes/${safeId}/refresh`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.refresh();
      } else {
        setError((data.error as string) || "Could not fetch Safe data");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center justify-center h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all btn-primary-glow"
      >
        {loading ? "Refreshing…" : "Refresh"}
      </button>
      {error && (
        <p className="text-sm text-destructive max-w-xs">{error}</p>
      )}
    </div>
  );
}
