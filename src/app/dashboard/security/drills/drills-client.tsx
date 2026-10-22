"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { DRILL_TYPES, DRILL_TYPE_LABELS } from "@/lib/readiness/drill-types";

type ScheduleRow = {
  schedule: {
    id: string;
    drillType: string;
    cadence: string;
    title: string;
    nextDueAt: string | null;
    lastCompletedAt: string | null;
    isActive: boolean;
    safeId: string | null;
  };
  safeName: string | null;
};

type RunRow = {
  run: {
    id: string;
    drillType: string;
    title: string;
    status: string;
    completedAt: string | null;
    notes: string | null;
  };
  safeName: string | null;
};

export function DrillsClient({ canManage }: { canManage: boolean }) {
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    drillType: "tabletop" as (typeof DRILL_TYPES)[number],
    title: "",
    notes: "",
  });

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/org/drill-schedules").then((r) => (r.ok ? r.json() : { schedules: [] })),
      fetch("/api/org/drill-runs").then((r) => (r.ok ? r.json() : { runs: [] })),
    ])
      .then(([s, r]) => {
        setSchedules(s.schedules ?? []);
        setRuns(r.runs ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function logDrill() {
    if (!form.title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/org/drill-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        drillType: form.drillType,
        title: form.title,
        status: "completed",
        completedAt: new Date().toISOString(),
        notes: form.notes || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setForm({ drillType: "tabletop", title: "", notes: "" });
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

  const now = Date.now();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Schedules</h2>
        </div>
        {schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No drill schedules yet.</p>
        ) : (
          <ul className="space-y-2">
            {schedules.map((s) => {
              const overdue =
                s.schedule.nextDueAt && new Date(s.schedule.nextDueAt).getTime() < now;
              return (
                <li
                  key={s.schedule.id}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-xs",
                    overdue ? "border-amber-500/50 bg-amber-500/5" : "border-border"
                  )}
                >
                  <p className="font-medium">{s.schedule.title}</p>
                  <p className="text-muted-foreground mt-1">
                    {DRILL_TYPE_LABELS[s.schedule.drillType as keyof typeof DRILL_TYPE_LABELS] ??
                      s.schedule.drillType}
                    {" · "}
                    {s.schedule.cadence.replace(/_/g, " ")}
                    {s.safeName && ` · ${s.safeName}`}
                  </p>
                  {s.schedule.nextDueAt && (
                    <p className={cn("mt-1", overdue && "text-amber-700 dark:text-amber-400")}>
                      Due {new Date(s.schedule.nextDueAt).toLocaleDateString()}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Drill history</h2>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Log drill
            </button>
          )}
        </div>

        {showForm && canManage && (
          <div className="rounded-xl border border-border p-3 space-y-2 text-xs">
            <select
              value={form.drillType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  drillType: e.target.value as (typeof DRILL_TYPES)[number],
                }))
              }
              className="w-full rounded-md border border-border bg-background px-2 py-1.5"
            >
              {DRILL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DRILL_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Drill title"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5"
            />
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notes / findings (optional)"
              rows={2}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5"
            />
            <button
              type="button"
              onClick={logDrill}
              disabled={saving || !form.title.trim()}
              className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save completed drill"}
            </button>
          </div>
        )}

        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No drills logged yet.</p>
        ) : (
          <ul className="space-y-2">
            {runs.map((r) => (
              <li key={r.run.id} className="rounded-lg border border-border px-3 py-2 text-xs">
                <p className="font-medium">{r.run.title}</p>
                <p className="text-muted-foreground mt-1">
                  {r.run.drillType.replace(/_/g, " ")}
                  {r.run.completedAt &&
                    ` · ${new Date(r.run.completedAt).toLocaleDateString()}`}
                </p>
                {r.run.notes && (
                  <p className="text-muted-foreground mt-1 line-clamp-2">{r.run.notes}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
