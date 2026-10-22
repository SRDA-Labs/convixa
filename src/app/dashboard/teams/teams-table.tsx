"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Pencil } from "lucide-react";
import { TeamsList } from "./teams-list";
import { EditTeamModal } from "./edit-team-modal";

export type TeamRow = {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  safeCount: number;
};

export function TeamsTable({
  teams,
  canCreate,
  initialTeamsForList,
  orgId,
  currentUser,
}: {
  teams: TeamRow[];
  canCreate: boolean;
  initialTeamsForList: { id: string; name: string; slug: string }[];
  orgId: string;
  currentUser: { id: string; name: string | null; email: string | null } | null;
}) {
  const router = useRouter();
  const [editingTeam, setEditingTeam] = useState<TeamRow | null>(null);

  const handleSaved = () => {
    setEditingTeam(null);
    router.refresh();
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          All teams
        </h2>
        {canCreate && (
          <TeamsList
            orgId={orgId}
            initialTeams={initialTeamsForList}
            currentUser={currentUser}
          />
        )}
      </div>

      {teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-12 px-6 text-center">
          <Shield className="h-12 w-12 text-muted-foreground/60" aria-hidden />
          <p className="mt-4 text-lg font-semibold text-foreground">No teams yet</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">{canCreate ? "Create one above to get started." : "Ask your org admin to add you to a team."}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card/30">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left" aria-label="Teams">
              <thead>
                <tr className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold border-b border-border bg-muted/30">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Slug</th>
                  <th className="px-6 py-4">Members</th>
                  <th className="px-6 py-4">Safes</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {teams.map((team) => (
                  <tr
                    key={team.id}
                    className="hover:bg-white/5 dark:hover:bg-white/5 transition-colors group"
                  >
                    <td className="px-6 py-5">
                      <span className="text-xs font-bold text-foreground">{team.name}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs text-muted-foreground font-mono">{team.slug}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs text-muted-foreground tabular-nums">{team.memberCount}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs text-muted-foreground tabular-nums">{team.safeCount}</span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/inventory?teamId=${team.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded"
                        >
                          <Shield className="h-3.5 w-3.5" aria-hidden />
                          Manage safes
                        </Link>
                        {canCreate && (
                          <button
                            type="button"
                            onClick={() => setEditingTeam(team)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded"
                            aria-label={`Edit ${team.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingTeam && (
        <EditTeamModal
          team={editingTeam}
          onClose={() => setEditingTeam(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
