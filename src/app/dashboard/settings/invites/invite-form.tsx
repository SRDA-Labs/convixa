"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2, CheckCircle } from "lucide-react";

export function InviteForm() {
  const [teams, setTeams] = useState<{ teamId: string; teamName: string }[]>([]);
  const [email, setEmail] = useState("");
  const [teamId, setTeamId] = useState("");
  const [role, setRole] = useState<"lead" | "member">("member");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then((d) => {
        if (d.teams) setTeams(d.teams);
        if (d.teams?.length && !teamId) setTeamId(d.teams[0].teamId);
      })
      .catch(() => setError("Failed to load teams"));
  }, [teamId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAcceptUrl(null);
    setLoading(true);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), teamId, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to create invite");
        return;
      }
      setAcceptUrl(data.acceptUrl ?? null);
      setEmail("");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden card-glow">
      <div className="border-b border-border bg-muted/30 px-5 py-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          Invite by email
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Send an invite link to add someone to a team
        </p>
      </div>
      <form onSubmit={handleSubmit} className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1 sm:max-w-[240px]">
            <label htmlFor="invite-email" className="block text-sm font-medium text-foreground mb-1.5">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="colleague@example.com"
              className={`${inputClass} w-full`}
            />
          </div>
          <div className="w-full sm:w-[160px]">
            <label htmlFor="invite-team" className="block text-sm font-medium text-foreground mb-1.5">
              Team
            </label>
            <select
              id="invite-team"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              required
              className={`${inputClass} w-full`}
            >
              <option value="">Select team</option>
              {teams.map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.teamName}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-[120px]">
            <label htmlFor="invite-role" className="block text-sm font-medium text-foreground mb-1.5">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as "lead" | "member")}
              className={`${inputClass} w-full`}
            >
              <option value="member">Member</option>
              <option value="lead">Lead</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading || teams.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Send invite
              </>
            )}
          </button>
        </div>
        {error && (
          <p className="mt-4 text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">
            {error}
          </p>
        )}
        {acceptUrl && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2.5">
            <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-foreground">Invite created</p>
              <p className="text-muted-foreground mt-0.5 text-xs font-mono break-all">
                {acceptUrl}
              </p>
              <p className="text-muted-foreground text-xs mt-1">Share this link with the invitee.</p>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
