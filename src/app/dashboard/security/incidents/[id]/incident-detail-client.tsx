"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  UserPlus,
  History,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  INCIDENT_STATUS_LABEL,
  INCIDENT_STATUS_DESCRIPTION,
  INCIDENT_STATUSES,
  INCIDENT_TYPE_LABEL,
  RESOLUTION_REQUIRED_STATUSES,
} from "@/lib/incidents/constants";

type IncidentCapabilities = {
  canView: boolean;
  canComment: boolean;
  canInvite: boolean;
  canManage: boolean;
};

type IncidentDetail = {
  id: string;
  title: string;
  description: string;
  incidentType: string;
  severity: string;
  status: string;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
};

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  userName: string | null;
  userEmail: string;
};

type Participant = {
  id: string;
  userId: string;
  role: string;
  userName: string | null;
  userEmail: string;
};

type Activity = {
  id: string;
  action: string;
  summary: string;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
};

type OrgMember = {
  id: string;
  userId: string;
  email: string;
  name: string | null;
};

function severityClass(s: string): string {
  if (s === "critical") return "bg-destructive/10 text-destructive";
  if (s === "high") return "bg-orange-500/10 text-orange-700 dark:text-orange-400";
  if (s === "medium") return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

function statusClass(s: string): string {
  if (s === "closed" || s === "resolved") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (s === "investigating" || s === "triaging") return "bg-primary/10 text-primary";
  return "bg-muted text-muted-foreground";
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function IncidentDetailClient({ incidentId }: { incidentId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [capabilities, setCapabilities] = useState<IncidentCapabilities | null>(null);

  const [description, setDescription] = useState("");
  const [descriptionDirty, setDescriptionDirty] = useState(false);
  const [comment, setComment] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [showResolution, setShowResolution] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const [activityExpanded, setActivityExpanded] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [inviteUserId, setInviteUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/org/incidents/${incidentId}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to load incident");
      }
      const data = await res.json();
      setIncident(data.incident);
      setComments(data.updates ?? []);
      setParticipants(data.participants ?? []);
      setActivity(data.activity ?? []);
      setCapabilities(data.capabilities ?? null);
      setDescription(data.incident?.description ?? "");
      setResolutionNotes(data.incident?.resolutionNotes ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!inviteOpen || !capabilities?.canInvite) return;
    fetch("/api/members")
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((d) => setMembers(d.members ?? []))
      .catch(() => setMembers([]));
  }, [inviteOpen, capabilities?.canInvite]);

  async function saveDescription() {
    if (!capabilities?.canManage) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/org/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to save description");
      }
      setDescriptionDirty(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim() || !capabilities?.canComment) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/org/incidents/${incidentId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: comment.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to post comment");
      }
      setComment("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comment failed");
    } finally {
      setSubmitting(false);
    }
  }

  function handleStatusSelect(next: string) {
    if (!capabilities?.canManage || next === incident?.status) return;
    if (RESOLUTION_REQUIRED_STATUSES.includes(next as (typeof RESOLUTION_REQUIRED_STATUSES)[number])) {
      setPendingStatus(next);
      setShowResolution(true);
      return;
    }
    void applyStatusChange(next);
  }

  async function applyStatusChange(next: string, resolution?: string) {
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, string> = { status: next };
      if (resolution?.trim()) body.resolutionNotes = resolution.trim();
      const res = await fetch(`/api/org/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to update status");
      }
      setShowResolution(false);
      setPendingStatus(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status update failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function inviteParticipant() {
    if (!inviteUserId || !capabilities?.canInvite) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/org/incidents/${incidentId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: inviteUserId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to invite");
      }
      setInviteUserId("");
      setInviteOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !incident) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/security/incidents"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to incidents
        </Link>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!incident) return null;

  const visibleActivity = activityExpanded ? activity : activity.slice(0, 3);
  const participantIds = new Set(participants.map((p) => p.userId));
  const inviteCandidates = members.filter((m) => !participantIds.has(m.userId));

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-5">
        <Link
          href="/dashboard/security/incidents"
          className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Incidents
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight truncate">{incident.title}</h1>
            <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", severityClass(incident.severity))}>
              {incident.severity}
            </span>
            <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", statusClass(incident.status))}>
              {INCIDENT_STATUS_LABEL[incident.status as keyof typeof INCIDENT_STATUS_LABEL] ?? incident.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {INCIDENT_TYPE_LABEL[incident.incidentType as keyof typeof INCIDENT_TYPE_LABEL] ?? incident.incidentType}
            {" · "}
            Reported {formatWhen(incident.createdAt)}
            {incident.reporterName || incident.reporterEmail
              ? ` by ${incident.reporterName ?? incident.reporterEmail}`
              : ""}
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5 min-w-0">
          {/* Description */}
          <section className="rounded-lg border border-border bg-card p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</h2>
              {capabilities?.canManage && descriptionDirty && (
                <button
                  type="button"
                  onClick={saveDescription}
                  disabled={submitting}
                  className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  Save
                </button>
              )}
            </div>
            {capabilities?.canManage ? (
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDescriptionDirty(e.target.value !== incident.description);
                }}
                rows={5}
                className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-xs resize-y min-h-[100px]"
                placeholder="What happened? Who is affected? What actions are underway?"
              />
            ) : (
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                {incident.description || "No description yet."}
              </p>
            )}
          </section>

          {/* Comments */}
          <section className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Discussion ({comments.length})
            </h2>
            {comments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No comments yet.</p>
            ) : (
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-medium">{c.userName ?? c.userEmail}</p>
                      <time className="text-[10px] text-muted-foreground">{formatWhen(c.createdAt)}</time>
                    </div>
                    <p className="mt-0.5 text-xs text-foreground whitespace-pre-wrap">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
            {capabilities?.canComment && (
              <form onSubmit={submitComment} className="space-y-2 pt-2 border-t border-border/50">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Add an update for the response team…"
                  className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-xs"
                />
                <button
                  type="submit"
                  disabled={submitting || !comment.trim()}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  Post comment
                </button>
              </form>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          {/* Status */}
          <section className="rounded-lg border border-border bg-card p-3 space-y-1.5">
            <label htmlFor="incident-status" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block">
              Status
            </label>
            {capabilities?.canManage ? (
              <select
                id="incident-status"
                value={incident.status}
                onChange={(e) => handleStatusSelect(e.target.value)}
                disabled={submitting}
                className={cn(
                  "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium",
                  statusClass(incident.status)
                )}
              >
                {INCIDENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {INCIDENT_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            ) : (
              <p
                className={cn(
                  "inline-flex rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium",
                  statusClass(incident.status)
                )}
              >
                {INCIDENT_STATUS_LABEL[incident.status as keyof typeof INCIDENT_STATUS_LABEL] ??
                  incident.status}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground leading-snug">
              {INCIDENT_STATUS_DESCRIPTION[incident.status as keyof typeof INCIDENT_STATUS_DESCRIPTION] ??
                ""}
            </p>
            {incident.resolutionNotes && (
              <div className="rounded-lg bg-muted/40 border border-border/60 px-3 py-2 text-xs">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Resolution
                </p>
                <p className="whitespace-pre-wrap text-foreground">{incident.resolutionNotes}</p>
              </div>
            )}
          </section>

          {/* Participants */}
          <section className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Response team</h2>
              {capabilities?.canInvite && (
                <button
                  type="button"
                  onClick={() => setInviteOpen((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Invite
                </button>
              )}
            </div>
            <ul className="space-y-2">
              {participants.map((p) => (
                <li key={p.id} className="text-xs">
                  <p className="font-medium text-foreground">{p.userName ?? p.userEmail}</p>
                  <p className="text-muted-foreground capitalize">{p.role}</p>
                </li>
              ))}
            </ul>
            {inviteOpen && capabilities?.canInvite && (
              <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
                <select
                  value={inviteUserId}
                  onChange={(e) => setInviteUserId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                >
                  <option value="">Select org member…</option>
                  {inviteCandidates.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name ?? m.email}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={inviteParticipant}
                  disabled={submitting || !inviteUserId}
                  className="w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  Add to incident
                </button>
              </div>
            )}
          </section>

          {/* Activity log */}
          <section className="rounded-lg border border-border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setActivityExpanded((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                Activity
              </span>
              {activity.length > 3 && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-0.5">
                  {activityExpanded ? (
                    <>
                      Show less <ChevronUp className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      {activity.length} events <ChevronDown className="h-3.5 w-3.5" />
                    </>
                  )}
                </span>
              )}
            </button>
            <ul className="border-t border-border divide-y divide-border/50">
              {visibleActivity.length === 0 ? (
                <li className="px-3 py-2.5 text-[11px] text-muted-foreground">No activity yet.</li>
              ) : (
                visibleActivity.map((a) => (
                  <li key={a.id} className="px-3 py-2.5">
                    <p className="text-[11px] text-foreground">{a.summary}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {a.userName ?? a.userEmail ?? "System"} · {formatWhen(a.createdAt)}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </section>
        </aside>
      </div>

      {/* Resolution modal */}
      {showResolution && pendingStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 space-y-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="resolution-title"
          >
            <h3 id="resolution-title" className="text-sm font-semibold">
              {pendingStatus === "closed" ? "Close incident" : "Resolve incident"}
            </h3>
            <p className="text-xs text-muted-foreground">
              Document the conclusion, root cause, and any changes made (min 10 characters).
            </p>
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="What was the outcome? What remediation steps were taken?"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowResolution(false);
                  setPendingStatus(null);
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || resolutionNotes.trim().length < 10}
                onClick={() => applyStatusChange(pendingStatus, resolutionNotes)}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
