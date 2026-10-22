"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, GripVertical, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ConditionConfig } from "@/lib/policy-engine/config";

const CONDITION_TYPES: {
  type: ConditionConfig["type"];
  label: string;
  description: string;
  defaultParams: Record<string, unknown>;
}[] = [
  { type: "amount_usd_greater_than", label: "Amount > USD", description: "Alert when tx value exceeds USD threshold", defaultParams: { value: 10000 } },
  { type: "counterparty_in_list", label: "Counterparty in list", description: "Check if destination is (or is not) in a list", defaultParams: { listId: "", mode: "deny" } },
  { type: "counterparty_not_in_list", label: "Counterparty not in list", description: "Alert when destination is not in a list", defaultParams: { listId: "" } },
  { type: "safe_tag_in", label: "Safe tag matches", description: "Filter by safe tags (e.g. cold, ops)", defaultParams: { tags: [] } },
  { type: "to_exchange", label: "To exchange", description: "Alert when destination is in exchange list", defaultParams: { listId: "" } },
  { type: "new_counterparty", label: "New counterparty", description: "Alert for first-time destinations", defaultParams: { lookbackDays: 30 } },
  { type: "per_period_spend_usd", label: "Period spend limit", description: "Alert when period spend exceeds limit", defaultParams: { period: "month", limit: 100000 } },
  { type: "time_of_day", label: "Time window", description: "Alert outside business hours", defaultParams: { window: { start: "09:00", end: "17:00", timezone: "UTC" } } },
  { type: "balance_change_pct", label: "Balance change %", description: "Alert on balance % change", defaultParams: { threshold: -50, lookbackMinutes: 60 } },
  { type: "event_type_in", label: "Event type match", description: "Alert on specific governance events", defaultParams: { eventTypes: [] } },
];

interface ConditionRow {
  id: string;
  condition: ConditionConfig;
}

interface ConditionComposerProps {
  conditions: ConditionConfig[];
  onChange: (conditions: ConditionConfig[]) => void;
  addressLists: { id: string; name: string }[];
}

export function ConditionComposer({ conditions, onChange, addressLists }: ConditionComposerProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [rows, setRows] = useState<ConditionRow[]>(
    conditions.map((c, i) => ({ id: `cond-${i}-${Date.now()}`, condition: structuredClone(c) }))
  );

  function syncToParent(updated: ConditionRow[]) {
    setRows(updated);
    onChange(updated.map((r) => r.condition));
  }

  function addCondition(type: ConditionConfig["type"]) {
    const template = CONDITION_TYPES.find((t) => t.type === type);
    if (!template) return;
    const newRow: ConditionRow = {
      id: `cond-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      condition: { type, ...template.defaultParams } as ConditionConfig,
    };
    syncToParent([...rows, newRow]);
    setAddOpen(false);
  }

  function removeCondition(id: string) {
    syncToParent(rows.filter((r) => r.id !== id));
  }

  function updateCondition(id: string, updates: Partial<ConditionConfig>) {
    syncToParent(
      rows.map((r) =>
        r.id === id ? { ...r, condition: { ...r.condition, ...updates } as ConditionConfig } : r
      )
    );
  }

  function updateNestedParam(id: string, parent: string, childKey: string, value: unknown) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const parentObj = (row.condition as Record<string, unknown>)[parent] as Record<string, unknown> | undefined;
    const updated = { ...parentObj, [childKey]: value };
    updateCondition(id, { [parent]: updated } as Partial<ConditionConfig>);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Conditions ({rows.length})
        </p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setAddOpen(!addOpen)}
            className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <Plus className="h-3 w-3" /> Add
            <ChevronDown className="h-3 w-3" />
          </button>
          {addOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setAddOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border border-border bg-card shadow-lg max-h-64 overflow-y-auto">
                {CONDITION_TYPES.filter((ct) => !rows.some((r) => r.condition.type === ct.type)).map((ct) => (
                  <button
                    key={ct.type}
                    type="button"
                    onClick={() => addCondition(ct.type)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/30 transition-colors border-b border-border last:border-b-0"
                  >
                    <span className="font-medium text-foreground">{ct.label}</span>
                    <span className="block text-[10px] text-muted-foreground">{ct.description}</span>
                  </button>
                ))}
                {CONDITION_TYPES.every((ct) => rows.some((r) => r.condition.type === ct.type)) && (
                  <p className="px-3 py-2 text-[10px] text-muted-foreground">All conditions added</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center">
          <AlertCircle className="mx-auto h-5 w-5 text-muted-foreground/60" />
          <p className="mt-1 text-xs text-muted-foreground">No conditions — policy will fire on every matching trigger.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div
              key={row.id}
              className="rounded-lg border border-border bg-muted/10 p-3 relative group"
            >
              <div className="flex items-start gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-foreground uppercase tracking-wide">
                      {CONDITION_TYPES.find((t) => t.type === row.condition.type)?.label ?? row.condition.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCondition(row.id)}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Per-condition parameter fields */}
                  {row.condition.type === "amount_usd_greater_than" && (
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground">Threshold USD:</label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={(row.condition as { value: number }).value}
                        onChange={(e) => updateCondition(row.id, { value: parseFloat(e.target.value) || 0 } as Partial<ConditionConfig>)}
                        className="w-24 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  )}

                  {row.condition.type === "counterparty_in_list" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={(row.condition as { listId: string }).listId}
                        onChange={(e) => updateCondition(row.id, { listId: e.target.value } as Partial<ConditionConfig>)}
                        className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 flex-1 min-w-[120px]"
                      >
                        <option value="">Select list</option>
                        {addressLists.map((l) => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                      <select
                        value={(row.condition as { mode: string }).mode}
                        onChange={(e) => updateCondition(row.id, { mode: e.target.value } as Partial<ConditionConfig>)}
                        className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                      >
                        <option value="deny">Deny (block if in list)</option>
                        <option value="allow">Allow (block if NOT in list)</option>
                      </select>
                    </div>
                  )}

                  {row.condition.type === "counterparty_not_in_list" && (
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground">List:</label>
                      <select
                        value={(row.condition as { listId: string }).listId}
                        onChange={(e) => updateCondition(row.id, { listId: e.target.value } as Partial<ConditionConfig>)}
                        className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 flex-1"
                      >
                        <option value="">Select list</option>
                        {addressLists.map((l) => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {row.condition.type === "to_exchange" && (
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground">Exchange list:</label>
                      <select
                        value={(row.condition as { listId: string }).listId}
                        onChange={(e) => updateCondition(row.id, { listId: e.target.value } as Partial<ConditionConfig>)}
                        className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 flex-1"
                      >
                        <option value="">Select list</option>
                        {addressLists.map((l) => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {row.condition.type === "safe_tag_in" && (
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground">Tags (comma-separated):</label>
                      <input
                        type="text"
                        value={(row.condition as { tags: string[] }).tags.join(", ")}
                        onChange={(e) =>
                          updateCondition(row.id, {
                            tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                          } as Partial<ConditionConfig>)
                        }
                        placeholder="cold, ops"
                        className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 flex-1"
                      />
                    </div>
                  )}

                  {row.condition.type === "new_counterparty" && (
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground">Lookback (days):</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={(row.condition as { lookbackDays: number }).lookbackDays}
                        onChange={(e) => updateCondition(row.id, { lookbackDays: parseInt(e.target.value, 10) || 30 } as Partial<ConditionConfig>)}
                        className="w-20 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  )}

                  {row.condition.type === "per_period_spend_usd" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={(row.condition as { period: string }).period}
                        onChange={(e) => updateCondition(row.id, { period: e.target.value } as Partial<ConditionConfig>)}
                        className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                      >
                        <option value="day">Per day</option>
                        <option value="week">Per week</option>
                        <option value="month">Per month</option>
                      </select>
                      <label className="text-[10px] text-muted-foreground">Limit USD:</label>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={(row.condition as { limit: number }).limit}
                        onChange={(e) => updateCondition(row.id, { limit: parseFloat(e.target.value) || 0 } as Partial<ConditionConfig>)}
                        className="w-28 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  )}

                  {row.condition.type === "time_of_day" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="time"
                        value={(row.condition as { window: { start: string } }).window.start}
                        onChange={(e) => updateNestedParam(row.id, "window", "start", e.target.value)}
                        className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                      <span className="text-[10px] text-muted-foreground">to</span>
                      <input
                        type="time"
                        value={(row.condition as { window: { end: string } }).window.end}
                        onChange={(e) => updateNestedParam(row.id, "window", "end", e.target.value)}
                        className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                      <span className="text-[10px] text-muted-foreground">TZ:</span>
                      <input
                        type="text"
                        value={(row.condition as { window: { timezone: string } }).window.timezone}
                        onChange={(e) => updateNestedParam(row.id, "window", "timezone", e.target.value)}
                        placeholder="UTC"
                        className="w-16 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  )}

                  {row.condition.type === "balance_change_pct" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="text-[10px] text-muted-foreground">Threshold %:</label>
                      <input
                        type="number"
                        step={1}
                        value={(row.condition as { threshold: number }).threshold}
                        onChange={(e) => updateCondition(row.id, { threshold: parseFloat(e.target.value) || 0 } as Partial<ConditionConfig>)}
                        className="w-20 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                      <label className="text-[10px] text-muted-foreground">Over (min):</label>
                      <input
                        type="number"
                        min={1}
                        value={(row.condition as { lookbackMinutes: number }).lookbackMinutes}
                        onChange={(e) => updateCondition(row.id, { lookbackMinutes: parseInt(e.target.value, 10) || 60 } as Partial<ConditionConfig>)}
                        className="w-16 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  )}

                  {row.condition.type === "event_type_in" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="text-[10px] text-muted-foreground">Event types:</label>
                      <input
                        type="text"
                        value={(row.condition as { eventTypes: string[] }).eventTypes.join(", ")}
                        onChange={(e) =>
                          updateCondition(row.id, {
                            eventTypes: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                          } as Partial<ConditionConfig>)
                        }
                        placeholder="SIGNER_ADD_PROPOSED, THRESHOLD_CHANGE_PROPOSED"
                        className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 flex-1"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* AND connector between conditions */}
              {idx < rows.length - 1 && (
                <div className="absolute -bottom-2 left-5 z-10">
                  <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[9px] font-bold text-primary uppercase">
                    AND
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
