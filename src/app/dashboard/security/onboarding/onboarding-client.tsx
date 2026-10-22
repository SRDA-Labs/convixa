"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Save, Pencil, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Entry = {
  rosterId: string;
  safeId: string;
  safeName: string | null;
  signerAddress: string;
  displayName: string | null;
  verificationStatus: string;
  status: string;
  completionPct: number;
  itemsState: Record<string, { completed: boolean; note?: string }>;
};

type TemplateItem = {
  id: string;
  label: string;
  type: "auto" | "manual";
  required?: boolean;
};

export function OnboardingClient({ canEdit }: { canEdit: boolean }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, { completed: boolean; note?: string }>>({});
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/org/onboarding-coverage")
      .then((r) => (r.ok ? r.json() : { entries: [], template: null }))
      .then((d) => {
        setEntries(d.entries ?? []);
        setItems(d.template?.itemsJson ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(entry: Entry) {
    setEditingId(entry.rosterId);
    setDraft({ ...entry.itemsState });
  }

  async function saveEdit(rosterId: string) {
    setSaving(true);
    const res = await fetch(`/api/org/onboarding-progress/${rosterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemsStateJson: draft }),
    });
    setSaving(false);
    if (res.ok) {
      setEditingId(null);
      load();
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!canEdit && (
        <p className="text-xs text-muted-foreground rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
          Org admins can update onboarding progress.
        </p>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No roster entries yet. Add signers on safe detail pages.
        </p>
      ) : (
        entries.map((e) => {
          const isEditing = editingId === e.rosterId;
          return (
            <div key={e.rosterId} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border/60">
                <div>
                  <p className="text-sm font-medium">
                    {e.displayName ?? e.signerAddress.slice(0, 10) + "…"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <Link href={`/dashboard/safes/${e.safeId}`} className="hover:underline">
                      {e.safeName ?? "Safe"}
                    </Link>
                    {" · "}
                    {e.verificationStatus}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-[10px] font-medium",
                      e.completionPct === 100
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    )}
                  >
                    {e.completionPct}%
                  </span>
                  {canEdit && !isEditing && (
                    <button
                      type="button"
                      onClick={() => startEdit(e)}
                      className="p-1 rounded hover:bg-muted/50 text-muted-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div className="px-4 py-3 space-y-2">
                  {items.map((item) => (
                    <label key={item.id} className="flex items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={draft[item.id]?.completed ?? false}
                        disabled={item.type === "auto"}
                        onChange={(ev) =>
                          setDraft((d) => ({
                            ...d,
                            [item.id]: {
                              ...d[item.id],
                              completed: ev.target.checked,
                              completedAt: ev.target.checked
                                ? new Date().toISOString()
                                : undefined,
                            },
                          }))
                        }
                        className="mt-0.5"
                      />
                      <span>
                        {item.label}
                        {item.type === "auto" && (
                          <span className="text-muted-foreground ml-1">(auto)</span>
                        )}
                      </span>
                    </label>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(e.rosterId)}
                      disabled={saving}
                      className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <ul className="px-4 py-2 space-y-1">
                  {items.map((item) => {
                    const done = e.itemsState[item.id]?.completed;
                    return (
                      <li key={item.id} className="text-xs flex items-center gap-2">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            done ? "bg-emerald-500" : "bg-muted-foreground/40"
                          )}
                        />
                        <span className={done ? "text-foreground" : "text-muted-foreground"}>
                          {item.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
