"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type Props = {
  userId: string;
  addableTeams: { teamId: string; teamName: string }[];
};

export function AddToTeamButton({ userId, addableTeams }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");

  async function handleAdd() {
    if (!selectedTeamId || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: "member" }),
      });
      if (res.ok) {
        setSelectedTeamId("");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to add to team");
      }
    } finally {
      setLoading(false);
    }
  }

  if (addableTeams.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={selectedTeamId}
        onChange={(e) => setSelectedTeamId(e.target.value)}
        className="text-xs border border-border rounded px-2 py-1 bg-muted/30 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20"
        disabled={loading}
      >
        <option value="">Add to team…</option>
        {addableTeams.map((t) => (
          <option key={t.teamId} value={t.teamId}>
            {t.teamName}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleAdd}
        disabled={!selectedTeamId || loading}
        className="text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded px-1.5 py-0.5"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" aria-hidden /> : "Add"}
      </button>
    </div>
  );
}
