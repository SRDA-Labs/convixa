"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  X,
  Loader2,
  CheckCircle,
  Clock,
  Ban,
  MoreVertical,
  Mail,
  Shield,
  Send,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { orgHubUrl } from "@/lib/org-management/constants";

function formatSentDate(date: Date): string {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHistoryDate(date: Date): string {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function roleDisplayName(role: string): string {
  return role === "lead" ? "Lead" : role === "member" ? "Member" : role;
}

export type InviteRow = {
  id: string;
  shortId?: string;
  email: string;
  teamId: string | null;
  teamName: string | null;
  role: string;
  expiresAt: Date;
  status: string;
  createdAt: Date;
  creatorName?: string | null;
};

type InvitesClientProps = {
  activeInvites: InviteRow[];
  historyInvites: InviteRow[];
  teams: { teamId: string; teamName: string }[];
};

export function InvitesClient({
  activeInvites: initialActive,
  historyInvites: initialHistory,
  teams,
}: InvitesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeInvites, setActiveInvites] = useState(initialActive);
  const [historyInvites, setHistoryInvites] = useState(initialHistory);

  useEffect(() => {
    setActiveInvites(initialActive);
    setHistoryInvites(initialHistory);
  }, [initialActive, initialHistory]);

  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [role, setRole] = useState<"lead" | "member">("member");
  const [message, setMessage] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const ANIMATION_MS = 200;

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => {
    setModalOpen(false);
    setError("");
    setEmail("");
    setTeamIds([]);
    setRole("member");
    setMessage("");
    setIsVisible(false);
    setIsClosing(false);
    router.replace(orgHubUrl("invites"), { scroll: false });
  }, [router]);

  const requestClose = useCallback(
    (afterClose?: () => void) => {
      if (isClosing) return;
      setIsClosing(true);
      setTimeout(() => {
        if (typeof afterClose === "function") afterClose();
        else closeModal();
      }, ANIMATION_MS);
    },
    [isClosing, closeModal]
  );

  useEffect(() => {
    if (modalOpen) {
      setIsClosing(false);
      const t = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(t);
    }
  }, [modalOpen]);

  useEffect(() => {
    if (searchParams.get("openInvite") === "1") openModal();
  }, [searchParams, openModal]);

  useEffect(() => {
    if (modalOpen && teams.length > 0 && teamIds.length === 0) setTeamIds([teams[0].teamId]);
  }, [modalOpen, teams, teamIds.length]);

  const refresh = useCallback(() => router.refresh(), [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitLoading(true);
    try {
      const teamId = teamIds[0] ?? teams[0]?.teamId;
      if (!teamId) {
        setError("Select at least one team");
        return;
      }
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
      requestClose(() => {
        closeModal();
        refresh();
      });
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancelInviteClick = (id: string) => {
    setMenuOpenId(null);
    setCancelConfirmId(id);
  };

  const handleCancelInviteConfirm = async () => {
    const id = cancelConfirmId;
    if (!id) return;
    setCancellingId(id);
    try {
      const res = await fetch(`/api/invites/${id}`, { method: "DELETE" });
      if (res.ok) {
        setActiveInvites((prev) => prev.filter((i) => i.id !== id));
        refresh();
      }
    } finally {
      setCancellingId(null);
    }
  };

  const addTeam = (teamId: string) => {
    setTeamIds([teamId]);
  };
  const removeTeam = (teamId: string) => {
    setTeamIds((prev) => prev.filter((id) => id !== teamId));
  };

  const inputBase =
    "w-full rounded-lg border border-border bg-muted/30 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent transition-colors";

  const show = modalOpen && isVisible && !isClosing;

  return (
    <>
      <ConfirmDialog
        open={cancelConfirmId !== null}
        onClose={() => setCancelConfirmId(null)}
        title="Cancel this invitation?"
        confirmLabel="Cancel invitation"
        cancelLabel="Keep"
        onConfirm={handleCancelInviteConfirm}
        destructive
        loading={cancellingId !== null}
      />
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-foreground">Active Invites</h3>
          <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs font-bold">
            {activeInvites.length}
          </span>
        </div>
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          {activeInvites.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Mail className="h-10 w-10 mx-auto opacity-60" aria-hidden />
              <p className="mt-4 font-medium text-foreground">No pending invites</p>
              <p className="mt-1 text-sm max-w-sm mx-auto">Use &quot;Invite Member&quot; to send an invitation.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-muted/20 border-b border-border">
                  <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Email Address
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Assigned Role
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Sent Date
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center">
                    Status
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeInvites.map((i) => (
                  <tr key={i.id} className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{i.email}</span>
                        <span className="text-xs text-muted-foreground">ID: {i.shortId ?? i.id.slice(-6)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold border",
                          i.role === "lead"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                            : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                        )}
                      >
                        {roleDisplayName(i.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {formatSentDate(new Date(i.createdAt))}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Pending
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onClick={() => setMenuOpenId(menuOpenId === i.id ? null : i.id)}
                          className="p-2 text-muted-foreground hover:text-primary transition-colors rounded"
                          aria-label="Actions"
                        >
                          <MoreVertical className="h-5 w-5" aria-hidden />
                        </button>
                        {menuOpenId === i.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              aria-hidden
                              onClick={() => setMenuOpenId(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 z-20 py-1 rounded-lg border border-border bg-card shadow-lg min-w-[140px]">
                              <button
                                type="button"
                                onClick={() => handleCancelInviteClick(i.id)}
                                disabled={cancellingId === i.id}
                                className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50 flex items-center gap-2"
                              >
                                {cancellingId === i.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                ) : (
                                  <Ban className="h-4 w-4" aria-hidden />
                                )}
                                Cancel invite
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">Invite History</h3>
            <p className="text-xs text-muted-foreground">(Last 30 days)</p>
          </div>
          <Link
            href={orgHubUrl("invites")}
            className="text-xs font-semibold text-primary hover:underline"
          >
            View All History
          </Link>
        </div>
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          {historyInvites.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No invite history in the last 30 days.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {historyInvites.map((i) => {
                const isAccepted = i.status === "accepted";
                const isExpired = i.status === "expired";
                return (
                  <div
                    key={i.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-muted/5 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                          isAccepted && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                          isExpired && "bg-muted text-muted-foreground"
                        )}
                      >
                        {isAccepted ? (
                          <CheckCircle className="h-5 w-5" aria-hidden />
                        ) : (
                          <Clock className="h-5 w-5" aria-hidden />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {isAccepted ? (
                            <>
                              {i.email} joined as <span className="text-primary">{roleDisplayName(i.role)}</span>
                            </>
                          ) : (
                            <>
                              Invite expired for <span className="text-muted-foreground">{i.email}</span>
                            </>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {i.email} • {i.creatorName ? `Invited by ${i.creatorName}` : "Link sent by System"}
                          {isExpired && " • Never accessed"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-muted-foreground">{formatHistoryDate(new Date(i.createdAt))}</p>
                      <p
                        className={cn(
                          "text-[10px] font-bold uppercase",
                          isAccepted && "text-emerald-500",
                          isExpired && "text-muted-foreground"
                        )}
                      >
                        {isAccepted ? "Accepted" : "Expired"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {modalOpen && typeof document !== "undefined" && createPortal(
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${show ? "opacity-100" : "opacity-0"} ${isClosing ? "pointer-events-none" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-modal-title"
          onClick={() => requestClose()}
        >
          <div
            className={`w-full max-w-lg rounded-lg border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-200 ease-out ${show ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <h2 id="invite-modal-title" className="text-base font-bold tracking-tight text-foreground uppercase">
                  Invite member
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Add a new member to your organization workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => requestClose()}
                className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
              <div className="p-5 space-y-5 overflow-y-auto">
                <div>
                  <label htmlFor="invite-email" className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                    <input
                      id="invite-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="colleague@company.com"
                      className={inputBase}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="invite-role" className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Organization role
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                    <select
                      id="invite-role"
                      value={role}
                      onChange={(e) => setRole(e.target.value as "lead" | "member")}
                      className={cn(inputBase, "pr-10 appearance-none cursor-pointer")}
                    >
                      <option value="member">Member</option>
                      <option value="lead">Lead</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Members can manage assets but cannot change organization settings.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Assign to teams</label>
                  <div className="min-h-[44px] p-2 rounded border border-border bg-muted/30 flex flex-wrap gap-2 items-center">
                    {teamIds.map((tid) => {
                      const t = teams.find((x) => x.teamId === tid);
                      return (
                        <span
                          key={tid}
                          className="inline-flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary border border-primary/30 rounded text-xs font-medium"
                        >
                          {t?.teamName ?? tid.slice(0, 8)}
                          <button
                            type="button"
                            onClick={() => removeTeam(tid)}
                            className="hover:text-primary/70"
                            aria-label={`Remove ${t?.teamName}`}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </span>
                      );
                    })}
                    <select
                      value=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) addTeam(v);
                        e.target.value = "";
                      }}
                      className="flex-1 min-w-[120px] bg-transparent border-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 py-1"
                    >
                      <option value="">Search teams...</option>
                      {teams.filter((t) => !teamIds.includes(t.teamId)).map((t) => (
                        <option key={t.teamId} value={t.teamId}>
                          {t.teamName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="invite-message" className="text-xs font-medium text-muted-foreground">
                      Personal message
                    </label>
                    <span className="text-xs text-muted-foreground">Optional</span>
                  </div>
                  <textarea
                    id="invite-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Hey, joining you to manage our multisig treasury..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded border border-border bg-muted/30 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent resize-none"
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-400" role="alert">
                    {error}
                  </p>
                )}
              </div>
              <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-3 shrink-0 bg-card">
                <button
                  type="button"
                  onClick={() => requestClose()}
                  className="rounded border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading || teams.length === 0 || teamIds.length === 0}
                  className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground uppercase tracking-wider hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                >
                  {submitLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="h-[18px] w-[18px]" aria-hidden />
                  )}
                  Send invitation
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
