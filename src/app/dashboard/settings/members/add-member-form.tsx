"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Team = { teamId: string; teamName: string };
type OrgRole = { id: string; name: string };

export function AddMemberButtonAndModal({ orgRoles }: { orgRoles: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-lg shadow-primary/20"
      >
        <Plus className="h-5 w-5" aria-hidden />
        Add member
      </button>
      {open && (
        <AddMemberModal
          orgRoles={orgRoles}
          onClose={() => setOpen(false)}
          onSuccess={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function AddMemberModal({
  orgRoles,
  onClose,
  onSuccess,
}: {
  orgRoles: OrgRole[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [role, setRole] = useState<"lead" | "member">("member");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
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
    startTransition(async () => {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          name: name.trim() || undefined,
          teamId,
          role,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to add member");
        return;
      }
      onSuccess();
      setEmail("");
      setPassword("");
      setName("");
      router.refresh();
    });
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-muted/30 py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus:border-primary transition-colors";
  const labelClass = "block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
      aria-labelledby="add-member-title"
    >
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg p-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 id="add-member-title" className="text-xl font-bold text-foreground">
              Add New Member
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Invite a new person to your organization.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="add-email" className={labelClass}>
              Email Address
            </label>
            <input
              id="add-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="member@example.com"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="add-name" className={labelClass}>
                Full Name (Optional)
              </label>
              <input
                id="add-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="add-initial-role" className={labelClass}>
                Initial Role
              </label>
              <select
                id="add-initial-role"
                value={role}
                onChange={(e) => setRole(e.target.value as "lead" | "member")}
                className={cn(inputClass, "appearance-none cursor-pointer")}
              >
                <option value="member">Member</option>
                <option value="lead">Lead</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="add-team" className={labelClass}>
                Team
              </label>
              <select
                id="add-team"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                required
                className={cn(inputClass, "appearance-none cursor-pointer")}
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
              <label htmlFor="add-password" className={labelClass}>
                Password
              </label>
              <input
                id="add-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Min 8 characters"
                className={inputClass}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Required for new users</p>
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || teams.length === 0}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {isPending ? "Adding…" : "Add member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
