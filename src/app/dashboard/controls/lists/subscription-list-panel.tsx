"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";

type SubscriptionMember = {
  id: string;
  subscriptionListId: string;
  email: string;
  createdAt: string;
};

type OrgMember = {
  id: string;
  email: string;
  name: string | null;
  roleName: string | null;
};

export type SubscriptionListDetail = {
  id: string;
  name: string;
  createdAt: string;
  members: SubscriptionMember[];
};

type SubscriptionListPanelProps = {
  listId: string;
  onUpdated?: () => void;
  onLoaded?: (list: SubscriptionListDetail) => void;
};

function displayName(email: string, name: string | null): string {
  return name?.trim() || email;
}

export function SubscriptionListPanel({
  listId,
  onUpdated,
  onLoaded,
}: SubscriptionListPanelProps) {
  const [list, setList] = useState<SubscriptionListDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [manualEmail, setManualEmail] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [removeSubmitting, setRemoveSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    if (!listId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/alerts/subscription-lists/${listId}`);
      if (!res.ok) {
        if (res.status === 404) setList(null);
        return;
      }
      const data = await res.json();
      const next = data.list ?? null;
      setList(next);
      if (next) onLoaded?.(next);
    } finally {
      setLoading(false);
    }
  }, [listId, onLoaded]);

  useEffect(() => {
    fetchList();
    fetch("/api/members")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setOrgMembers(data.members ?? []);
      })
      .catch(() => {});
  }, [fetchList]);

  const memberEmails = new Set((list?.members ?? []).map((m) => m.email.toLowerCase()));
  const availableOrgMembers = orgMembers.filter((m) => !memberEmails.has(m.email.toLowerCase()));

  async function addEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) return;
    setAddSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/alerts/subscription-lists/${listId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add member");
        return;
      }
      setManualEmail("");
      await fetchList();
      onUpdated?.();
    } finally {
      setAddSubmitting(false);
    }
  }

  async function removeMember(memberId: string) {
    setRemoveSubmitting(memberId);
    try {
      const res = await fetch(`/api/alerts/subscription-lists/${listId}/members/${memberId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchList();
        onUpdated?.();
      }
    } finally {
      setRemoveSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-muted-foreground py-12">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  if (!list) {
    return <p className="text-sm text-muted-foreground py-6">Subscription list not found.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Members receive email when an alert rule or policy references this list on first fire.
      </p>

      <div className="rounded-lg border border-border p-3 space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> Add recipients
        </h3>

        {availableOrgMembers.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Org members</p>
            <ul className="flex flex-wrap gap-2">
              {availableOrgMembers.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    disabled={addSubmitting}
                    onClick={() => addEmail(m.email)}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted/50 disabled:opacity-50"
                  >
                    <Plus className="h-3 w-3" />
                    {displayName(m.email, m.name)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            addEmail(manualEmail);
          }}
          className="flex flex-wrap gap-2 items-end"
        >
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-muted-foreground mb-1">Or add email</label>
            <input
              type="email"
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="w-full rounded-md border border-border px-2.5 py-1.5 text-sm"
              disabled={addSubmitting}
            />
          </div>
          <button
            type="submit"
            disabled={addSubmitting || !manualEmail.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Add
          </button>
        </form>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Recipients ({list.members.length})</h3>
        {list.members.length === 0 ? (
          <p className="text-xs text-muted-foreground">No recipients yet.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden max-h-[240px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name / email</th>
                  <th className="px-3 py-2 text-left font-medium w-[80px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.members.map((m) => {
                  const orgMatch = orgMembers.find(
                    (o) => o.email.toLowerCase() === m.email.toLowerCase()
                  );
                  return (
                    <tr key={m.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <p className="font-medium">{displayName(m.email, orgMatch?.name ?? null)}</p>
                        <p className="text-muted-foreground">{m.email}</p>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeMember(m.id)}
                          disabled={removeSubmitting === m.id}
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
                        >
                          {removeSubmitting === m.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
