"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type Props = {
  teamId: string;
  teamName: string;
  userId: string;
};

export function RemoveFromTeamButton({ teamId, teamName, userId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${userId}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to remove from team");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleRemove}
      disabled={loading}
      className="text-xs font-medium text-destructive hover:text-destructive/80 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded px-1.5 py-0.5"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin inline" aria-hidden />
      ) : (
        `Remove from ${teamName}`
      )}
    </button>
  );
}
