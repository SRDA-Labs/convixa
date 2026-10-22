"use client";

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Search, Lock } from "lucide-react";

export type CreateTeamMember = {
  userId: string;
  email: string | null;
  name: string | null;
  role: "lead" | "member";
  isCurrentUser?: boolean;
};

function getInitials(name: string | null, email: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

export function CreateTeamModal({
  currentUser,
  onClose,
  onSaved,
}: {
  currentUser: { id: string; name: string | null; email: string | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [members, setMembers] = useState<CreateTeamMember[]>(() => [
    {
      userId: currentUser.id,
      email: currentUser.email ?? null,
      name: currentUser.name ?? null,
      role: "lead",
      isCurrentUser: true,
    },
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ userId: string; email: string | null; name: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const ANIMATION_MS = 200;

  // Enter animation: trigger visible state after first paint
  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const requestClose = useCallback(
    (afterClose?: () => void) => {
      if (isClosing) return;
      setIsClosing(true);
      const id = setTimeout(() => {
        if (typeof afterClose === "function") afterClose();
        else onClose();
      }, ANIMATION_MS);
      return () => clearTimeout(id);
    },
    [isClosing, onClose]
  );

  // Auto-slug from name when slug is empty
  useEffect(() => {
    if (!slug.trim()) {
      setSlug(
        name
          .toLowerCase()
          .trim()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "") || ""
      );
    }
  }, [name]);

  const searchMembers = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data.members) ? data.members : [];
      setSearchResults(
        list.map((m: { userId: string; email: string | null; name: string | null }) => ({
          userId: m.userId,
          email: m.email ?? null,
          name: m.name ?? null,
        }))
      );
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchMembers(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery, searchMembers]);

  const addMember = (user: { userId: string; email: string | null; name: string | null }) => {
    if (members.some((m) => m.userId === user.userId)) return;
    setMembers((prev) => [...prev, { ...user, role: "member" as const }]);
    setSearchQuery("");
    setSearchResults([]);
  };

  const removeMember = (userId: string) => {
    if (userId === currentUser.id) return;
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to create team");
        return;
      }
      const teamId = data.team?.id;
      if (!teamId) {
        setError("Team created but failed to add members");
        return;
      }
      for (const m of members) {
        const memberRes = await fetch(`/api/teams/${teamId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: m.userId, role: m.role }),
        });
        if (!memberRes.ok) {
          const errData = await memberRes.json().catch(() => ({}));
          setError(errData.error ?? `Failed to add ${m.name ?? m.email ?? "member"}`);
          return;
        }
      }
      requestClose(onSaved);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const show = isVisible && !isClosing;

  const modal = (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${show ? "opacity-100" : "opacity-0"} ${isClosing ? "pointer-events-none" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-team-title"
      onClick={() => requestClose()}
    >
      <div
        className={`rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transition-all duration-200 ease-out ${show ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <h2 id="create-team-title" className="text-base font-bold tracking-tight text-white uppercase">
            Create team
          </h2>
          <button
            type="button"
            onClick={() => requestClose()}
            className="rounded p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 overflow-hidden">
          <div className="px-5 py-5 space-y-8 overflow-y-auto">
            {/* 01 TEAM IDENTITY */}
            <div>
              <p className="text-sm font-medium text-zinc-200 mb-4">
                <span className="text-primary mr-1.5">01</span> Team identity
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="create-team-name" className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Team name
                  </label>
                  <input
                    id="create-team-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. Finance"
                    className="w-full rounded border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="create-team-slug" className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Slug (optional)
                  </label>
                  <input
                    id="create-team-slug"
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="finance"
                    className="w-full rounded border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-200 font-mono placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* 02 TEAM MEMBERS */}
            <div>
              <p className="text-sm font-medium text-zinc-200 mb-4">
                <span className="text-primary mr-1.5">02</span> Team members
              </p>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" aria-hidden />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users by name or email..."
                  className="w-full rounded border border-zinc-700 bg-zinc-900/80 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-transparent"
                  aria-label="Search users to add"
                />
                {searchQuery.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded border border-zinc-700 bg-zinc-900 shadow-xl z-10 max-h-52 overflow-y-auto">
                    {searching ? (
                      <div className="px-3 py-3 text-sm text-zinc-400">Searching…</div>
                    ) : searchResults.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-zinc-400">No users found</div>
                    ) : (
                      searchResults
                        .filter((u) => !members.some((m) => m.userId === u.userId))
                        .map((u) => (
                          <button
                            key={u.userId}
                            type="button"
                            onClick={() => addMember(u)}
                            className="w-full text-left px-3 py-2.5 text-sm text-white hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-800 last:border-b-0"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-zinc-800 text-xs font-medium text-zinc-200">
                              {getInitials(u.name, u.email)}
                            </span>
                            <span className="min-w-0 truncate">
                              <span className="block truncate">{u.name ?? u.email ?? u.userId}</span>
                              {u.email && (
                                <span className="text-xs text-zinc-500 truncate block">{u.email}</span>
                              )}
                            </span>
                          </button>
                        ))
                    )}
                  </div>
                )}
              </div>

              <div className="rounded border border-zinc-800 overflow-hidden">
                <table className="w-full text-sm" aria-label="Team members">
                  <thead>
                    <tr className="bg-zinc-900/80 border-b border-zinc-800">
                      <th className="text-left font-medium text-zinc-400 py-3 px-4 text-xs">
                        User
                      </th>
                      <th className="text-left font-medium text-zinc-400 py-3 px-4 text-xs">
                        Role
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.userId} className="border-b border-zinc-800 last:border-b-0 hover:bg-zinc-900/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-zinc-800 text-xs font-medium text-white">
                              {getInitials(m.name, m.email)}
                            </span>
                            <div className="min-w-0">
                              <span className="font-medium text-white truncate block">
                                {m.name ?? m.email ?? "Unknown"}
                                {m.isCurrentUser && " (You)"}
                              </span>
                              {m.email && (
                                <span className="text-xs text-zinc-500 truncate block">{m.email}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5">
                            {m.role === "lead" ? (
                              <span className="inline-flex items-center gap-1 rounded border border-primary/60 bg-primary/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                                Admin
                                <Lock className="h-3 w-3 shrink-0" aria-hidden />
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded border border-zinc-600 bg-zinc-800/50 px-2.5 py-1 text-xs font-medium uppercase tracking-wider text-zinc-300">
                                Member
                                <button
                                  type="button"
                                  onClick={() => removeMember(m.userId)}
                                  className="rounded p-0.5 text-zinc-400 hover:text-white hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                                  aria-label={`Remove ${m.name ?? m.email}`}
                                >
                                  <X className="h-3.5 w-3.5" aria-hidden />
                                </button>
                              </span>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="flex gap-3 justify-end px-5 py-4 border-t border-zinc-800 shrink-0 bg-zinc-950">
            <button
              type="button"
              onClick={() => requestClose()}
              className="rounded border border-zinc-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-primary px-4 py-2.5 text-sm font-semibold text-white uppercase tracking-wider hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              {loading ? "Creating…" : "Create team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
