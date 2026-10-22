"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Save, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { SAFE_TX_TYPES, SAFE_TX_TYPE_LABELS } from "@/lib/pre-sign-checklist/tx-types";

type ChecklistItem = {
  id: string;
  label: string;
  type: "auto" | "manual";
  autoRule?: string;
  required?: boolean;
};

type Template = {
  id: string;
  name: string;
  classification: string | null;
  txCategories: string[] | null;
  itemsJson: ChecklistItem[] | null;
  isDefault: boolean;
};

export function ChecklistTemplatesClient({ canEdit }: { canEdit: boolean }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    name: string;
    txCategories: string[];
    items: ChecklistItem[];
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/org/checklist-templates")
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => {
        setTemplates(d.templates ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(t: Template) {
    setEditingId(t.id);
    setDraft({
      name: t.name,
      txCategories: t.txCategories ?? [],
      items: (t.itemsJson ?? []).map((item) => ({ ...item })),
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setError(null);
  }

  async function saveEdit() {
    if (!editingId || !draft) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/org/checklist-templates/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        txCategories: draft.txCategories,
        itemsJson: draft.items,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not save template");
      setSaving(false);
      return;
    }
    cancelEdit();
    load();
    setSaving(false);
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
          Org admins can edit templates. You have read-only access.
        </p>
      )}

      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No checklist templates found.</p>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => {
            const isEditing = editingId === t.id;
            return (
              <div
                key={t.id}
                className="rounded-xl border border-border overflow-hidden bg-card"
              >
                <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border/60">
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(t.txCategories ?? []).join(", ") || "No types"}
                      {t.classification ? ` · ${t.classification}` : ""}
                      {t.isDefault && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px]">Default</span>
                      )}
                    </p>
                  </div>
                  {canEdit && !isEditing && (
                    <button
                      type="button"
                      onClick={() => startEdit(t)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted/50"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>
                  )}
                </div>

                {isEditing && draft ? (
                  <div className="px-4 py-3 space-y-3 text-xs">
                    <label className="block space-y-1">
                      <span className="font-medium">Name</span>
                      <input
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className="w-full rounded-md border border-border px-2 py-1.5"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="font-medium">Transaction type</span>
                      <select
                        value={draft.txCategories[0] ?? "UNKNOWN"}
                        onChange={(e) =>
                          setDraft({ ...draft, txCategories: [e.target.value] })
                        }
                        className="w-full rounded-md border border-border px-2 py-1.5"
                      >
                        {SAFE_TX_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {SAFE_TX_TYPE_LABELS[type]} ({type})
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="space-y-2">
                      <span className="font-medium">Checklist items</span>
                      {draft.items.map((item, idx) => (
                        <div key={item.id} className="flex gap-2 items-start">
                          <input
                            value={item.label}
                            onChange={(e) => {
                              const items = [...draft.items];
                              items[idx] = { ...item, label: e.target.value };
                              setDraft({ ...draft, items });
                            }}
                            className="flex-1 rounded-md border border-border px-2 py-1.5"
                          />
                          <label className="flex items-center gap-1 shrink-0 pt-1.5">
                            <input
                              type="checkbox"
                              checked={item.required ?? false}
                              onChange={(e) => {
                                const items = [...draft.items];
                                items[idx] = { ...item, required: e.target.checked };
                                setDraft({ ...draft, items });
                              }}
                            />
                            Req.
                          </label>
                        </div>
                      ))}
                    </div>
                    {error && <p className="text-destructive">{error}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={saving}
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                      >
                        <Save className="h-3 w-3" />
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <ul className="px-4 py-2 space-y-1 text-xs text-muted-foreground">
                    {(t.itemsJson ?? []).map((item) => (
                      <li key={item.id} className="flex gap-2">
                        <span className={cn(item.required && "text-foreground font-medium")}>
                          {item.label}
                        </span>
                        {item.required && <span>(required)</span>}
                        <span className="text-[10px] uppercase">{item.type}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
