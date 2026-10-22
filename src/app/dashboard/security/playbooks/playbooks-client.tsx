"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Save, X } from "lucide-react";
import { PLAYBOOK_SCENARIO_LABELS, type PlaybookScenario } from "@/lib/readiness/default-playbooks";

type Playbook = {
  id: string;
  scenario: string;
  title: string;
  version: number;
  contentMd: string;
  publishedAt: string;
  isDefault: boolean;
};

export function PlaybooksClient({ canEdit }: { canEdit: boolean }) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", contentMd: "" });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/org/playbooks")
      .then((r) => (r.ok ? r.json() : { playbooks: [] }))
      .then((d) => {
        setPlaybooks(d.playbooks ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const active = playbooks.find((p) => p.id === selected) ?? playbooks[0] ?? null;

  useEffect(() => {
    if (!selected && playbooks[0]) setSelected(playbooks[0].id);
  }, [playbooks, selected]);

  function startEdit() {
    if (!active) return;
    setDraft({ title: active.title, contentMd: active.contentMd });
    setEditing(true);
  }

  async function saveEdit() {
    if (!active) return;
    setSaving(true);
    const res = await fetch(`/api/org/playbooks/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setSaving(false);
    if (res.ok) {
      const d = await res.json();
      setEditing(false);
      if (d.playbook?.id) setSelected(d.playbook.id);
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
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <ul className="space-y-1">
        {playbooks.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => {
                setSelected(p.id);
                setEditing(false);
              }}
              className={`w-full text-left rounded-md px-2.5 py-2 text-xs transition-colors ${
                active?.id === p.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {PLAYBOOK_SCENARIO_LABELS[p.scenario as PlaybookScenario] ?? p.title}
              <span className="block text-[10px] opacity-70">v{p.version}</span>
            </button>
          </li>
        ))}
      </ul>

      {active ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/60">
            <div>
              <h3 className="text-sm font-medium">{active.title}</h3>
              <p className="text-[11px] text-muted-foreground">
                Published {new Date(active.publishedAt).toLocaleDateString()} · v{active.version}
              </p>
            </div>
            {canEdit && !editing && (
              <button
                type="button"
                onClick={startEdit}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
                New version
              </button>
            )}
          </div>

          {editing ? (
            <div className="p-4 space-y-2">
              <input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
              <textarea
                value={draft.contentMd}
                onChange={(e) => setDraft((d) => ({ ...d, contentMd: e.target.value }))}
                rows={16}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  Publish v{active.version + 1}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <pre className="p-4 text-xs whitespace-pre-wrap font-sans text-muted-foreground max-h-[480px] overflow-y-auto">
              {active.contentMd}
            </pre>
          )}

          <p className="px-4 py-2 text-[10px] text-muted-foreground border-t border-border/60">
            Operational guidance only — not legal advice. Org-owned content.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No playbooks found.</p>
      )}
    </div>
  );
}
