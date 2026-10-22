import Link from "next/link";
import { fetchMemberData, ORG_PAGE_SIZE } from "@/lib/org-management/data";
import { orgHubUrl } from "@/lib/org-management/constants";
import { MemberRoleSelect } from "../settings/members/member-role-select";
import { AddMemberButtonAndModal } from "../settings/members/add-member-form";
import { RemoveFromTeamButton } from "../settings/members/remove-from-team-button";
import { AddToTeamButton } from "../settings/members/add-to-team-button";

function initials(name: string | null, email: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0]! + parts[parts.length - 1]![0]).toUpperCase();
    return (parts[0]!.slice(0, 2) || "?").toUpperCase();
  }
  const local = email.split("@")[0];
  if (local?.length >= 2) return local.slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export async function MembersTab({ orgId, page }: { orgId: string; page: number }) {
  const { members, orgRoles, canUpdate, admin } = await fetchMemberData(orgId);

  const total = members.length;
  const totalPages = Math.max(1, Math.ceil(total / ORG_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * ORG_PAGE_SIZE;
  const paginatedMembers = members.slice(start, start + ORG_PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? "No members on this instance yet"
            : `${total} user${total === 1 ? "" : "s"} on this instance`}
        </p>
        {admin && <AddMemberButtonAndModal orgRoles={orgRoles} />}
      </div>

      <div className="rounded-xl border border-border bg-card/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left" aria-label="Organization members">
            <thead>
              <tr className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold border-b border-border bg-muted/30">
                <th className="px-6 py-4">Member</th>
                <th className="px-6 py-4">Org role</th>
                <th className="px-6 py-4">Custom role</th>
                <th className="px-6 py-4">Teams</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedMembers.map((m) => (
                <tr key={m.id} className="hover:bg-muted/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={
                          m.role === "admin"
                            ? "w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary"
                            : "w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground"
                        }
                      >
                        {initials(m.name, m.email)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {m.name?.trim() || m.email.split("@")[0] || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {m.role === "admin" || m.role === "owner" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        {m.role === "owner" ? "Owner" : "Admin"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-muted text-muted-foreground border border-border">
                        Member
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">{m.roleName ?? "—"}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {m.teams.length > 0 ? (
                        m.teams.map((t) => (
                          <div key={t.teamId} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden />
                            <span className="text-xs font-medium text-foreground">{t.teamName}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {m.removableTeams.length > 0 && m.role !== "admin" && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {m.removableTeams.map((t) => (
                            <RemoveFromTeamButton
                              key={t.teamId}
                              teamId={t.teamId}
                              teamName={t.teamName}
                              userId={m.userId}
                            />
                          ))}
                        </div>
                      )}
                      {m.addableTeams.length > 0 && m.role !== "admin" && (
                        <div className="mt-1">
                          <AddToTeamButton userId={m.userId} addableTeams={m.addableTeams} />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {canUpdate ? (
                      m.role === "admin" || m.role === "owner" ? (
                        <span className="text-xs text-muted-foreground">Full access</span>
                      ) : (
                        <MemberRoleSelect membershipId={m.id} currentRoleId={m.roleId} orgRoles={orgRoles} />
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <p>
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-4">
            {currentPage <= 1 ? (
              <span className="opacity-30 cursor-not-allowed">Previous</span>
            ) : (
              <Link href={orgHubUrl("members", { page: currentPage - 1 })} className="hover:text-primary transition-colors">
                Previous
              </Link>
            )}
            {currentPage >= totalPages ? (
              <span className="opacity-30 cursor-not-allowed">Next</span>
            ) : (
              <Link href={orgHubUrl("members", { page: currentPage + 1 })} className="hover:text-primary transition-colors">
                Next
              </Link>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
