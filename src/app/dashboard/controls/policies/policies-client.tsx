"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  FileCheck,
  Pencil,
  Trash2,
  Shield,
  Zap,
  CheckCircle,
  Ban,
  Bell,
  FileText,
  BarChart3,
  History,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { POLICY_TEMPLATES } from "@/lib/policy-engine/templates";
import type { PolicyConfig } from "@/lib/policy-engine/config";
import type { ConditionConfig } from "@/lib/policy-engine/config";
import type { ActionConfig } from "@/lib/policy-engine/config";
import { ConditionComposer } from "@/components/condition-composer";

type PolicySummary = {
  id: string;
  orgId: string;
  name: string;
  type: string;
  scope: string;
  safeId: string | null;
  config: Record<string, unknown>;
  subscriptionListId: string | null;
  enabled: boolean;
  createdAt: string;
  createdByUserId: string | null;
  lastFiredAt: string | null;
};

type EnforcementLogEntry = {
  id: string;
  policyId: string;
  policyName: string;
  safeId: string;
  safeAddress: string;
  safeName: string | null;
  safeTxHash: string | null;
  triggerType: string;
  actionType: string;
  actionDetails: Record<string, unknown>;
  notificationSent: boolean;
  firedAt: string;
};

const PAGE_SIZE = 10;

/** Display ID like POL-0922-A from policy uuid. */
function policyDisplayId(id: string): string {
  const hex = id.replace(/-/g, "").slice(-6).toUpperCase();
  const part = hex.slice(0, 4);
  const letter = hex.slice(-1);
  return `POL-${part}-${letter}`;
}

/** Severity from config: block → critical, else first alert severity. */
function getSeverity(p: PolicySummary): "critical" | "high" | "info" {
  const config = p.config as { actions?: ActionConfig[] };
  const actions = config?.actions ?? [];
  const hasBlock = actions.some((a) => a.type === "block");
  if (hasBlock) return "critical";
  const alert = actions.find((a) => a.type === "alert");
  if (!alert || alert.type !== "alert") return "info";
  if (alert.severity === "critical") return "critical";
  if (alert.severity === "warning") return "high";
  return "info";
}

/** Short condition summary from first condition. */
function getConditionSummary(p: PolicySummary): string {
  const config = p.config as { conditions?: Array<Record<string, unknown>> };
  const conditions = config?.conditions ?? [];
  const c = conditions[0];
  if (!c) return "—";
  const t = c.type as string;
  if (t === "amount_usd_greater_than" && typeof c.value === "number")
    return `amount > $${c.value.toLocaleString()}`;
  if (t === "approval_amount_usd_greater_than" && typeof c.value === "number")
    return `approval > $${c.value.toLocaleString()}`;
  if (t === "counterparty_not_in_list") return "to not in [safelist]";
  if (t === "counterparty_in_list") return "to in list";
  if (t === "to_exchange") return "to exchange list";
  if (t === "safe_tag_in" && Array.isArray(c.tags)) return `safe in [${(c.tags as string[]).join(", ")}]`;
  if (t === "new_counterparty") return "new counterparty";
  if (t === "per_period_spend_usd" && typeof c.limit === "number")
    return `spend > $${(c.limit as number).toLocaleString()}/${c.period ?? "month"}`;
  if (t === "balance_change_pct" && typeof c.threshold === "number")
    return `balance ${c.threshold > 0 ? "+" : ""}${c.threshold}% in ${c.lookbackMinutes ?? 60}m`;
  if (t === "event_type_in" && Array.isArray(c.eventTypes))
    return (c.eventTypes as string[]).join(", ");
  if (t === "time_of_day") return "time window";
  return t ?? "—";
}

/** Primary action label and icon color. */
function getPrimaryAction(p: PolicySummary): { label: string; icon: "block" | "alert" | "log" } {
  const config = p.config as { actions?: ActionConfig[] };
  const actions = config?.actions ?? [];
  const block = actions.find((a) => a.type === "block");
  if (block) return { label: "Block Tx", icon: "block" };
  const alert = actions.find((a) => a.type === "alert");
  if (alert) return { label: "Alert", icon: "alert" };
  return { label: "Log Only", icon: "log" };
}

/** Display label for policy type (template id → name, else type as-is). */
function policyTypeLabel(type: string): string {
  const t = POLICY_TEMPLATES.find((x) => x.id === type);
  return t ? t.name : type;
}

const SEVERITY_STYLES = {
  critical: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50",
  high: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900/50",
  info: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50",
} as const;

const SEVERITY_DOT = {
  critical: "bg-red-500 shadow-sm shadow-red-500/50",
  high: "bg-orange-400",
  info: "bg-blue-400",
} as const;

export function PoliciesClient() {
  const [policies, setPolicies] = useState<PolicySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createTemplateId, setCreateTemplateId] = useState<string>(POLICY_TEMPLATES[0]?.id ?? "multisig_activity");
  const [createScope, setCreateScope] = useState<"org" | "safe">("org");
  const [createSafeId, setCreateSafeId] = useState("");
  const [createSubscriptionListId, setCreateSubscriptionListId] = useState("");
  const [createListId, setCreateListId] = useState(""); // address list for allowlist / to_exchange
  const [createAmountUsd, setCreateAmountUsd] = useState("");
  const [createTimeStart, setCreateTimeStart] = useState("00:00");
  const [createTimeEnd, setCreateTimeEnd] = useState("06:00");
  const [createTimeTz, setCreateTimeTz] = useState("UTC");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
    safesEvaluated: number; transactionsEvaluated: number;
    alertsThatWouldHaveFired: number; violationsThatWouldHaveBlocked: number;
    samples: Array<{ safeName: string | null; to?: string; value?: string; reason: string }>;
  } | null>(null);
  const [safes, setSafes] = useState<{ id: string; name: string | null; address: string }[]>([]);
  const [subscriptionLists, setSubscriptionLists] = useState<{ id: string; name: string; memberCount?: number }[]>([]);
  const [addressLists, setAddressLists] = useState<{ id: string; name: string }[]>([]);
  const [safesList, setSafesList] = useState<{ id: string; name: string | null; address: string }[]>([]);
  const [page, setPage] = useState(1);

  // Enforcement log state
  const [showEnforcementLog, setShowEnforcementLog] = useState(false);
  const [enforcementLogs, setEnforcementLogs] = useState<EnforcementLogEntry[]>([]);
  const [enforcementLoading, setEnforcementLoading] = useState(false);
  const [enforcementPage, setEnforcementPage] = useState(1);
  const ENFORCEMENT_PAGE_SIZE = 10;

  // Custom condition composer state
  const [customConditions, setCustomConditions] = useState<ConditionConfig[]>([]);
  const [customTrigger, setCustomTrigger] = useState<"pending_tx" | "config_change" | "balance_change">("pending_tx");
  const [customActionType, setCustomActionType] = useState<"alert" | "block">("alert");

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/org/policies");
      if (!res.ok) return;
      const data = await res.json();
      setPolicies(data.policies ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  useEffect(() => {
    fetch("/api/safes")
      .then((r) => r.json())
      .then((d) => setSafesList(d.safes ?? []))
      .catch(() => setSafesList([]));
  }, []);

  const activePolicies = useMemo(() => policies.filter((p) => p.enabled), [policies]);
  const thisWeek = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return policies.filter((p) => new Date(p.createdAt) >= cutoff).length;
  }, [policies]);
  const paginatedPolicies = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return policies.slice(start, start + PAGE_SIZE);
  }, [policies, page]);
  const totalPages = Math.max(1, Math.ceil(policies.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);
  const safeNameById = useMemo(() => {
    const m: Record<string, string> = {};
    safesList.forEach((s) => (m[s.id] = s.name ?? s.address.slice(0, 10) + "…"));
    return m;
  }, [safesList]);

  useEffect(() => {
    if (createOpen) {
      fetch("/api/safes")
        .then((r) => r.json())
        .then((d) => setSafes(d.safes ?? []))
        .catch(() => setSafes([]));
      fetch("/api/alerts/subscription-lists")
        .then((r) => r.json())
        .then((d) => setSubscriptionLists(d.lists ?? []))
        .catch(() => setSubscriptionLists([]));
      fetch("/api/org/lists")
        .then((r) => r.json())
        .then((d) => setAddressLists((d.lists ?? []).map((l: { id: string; name: string }) => ({ id: l.id, name: l.name }))))
        .catch(() => setAddressLists([]));
    }
  }, [createOpen]);

  function buildConfigFromTemplate(): PolicyConfig | null {
    // Custom composer mode
    if (createTemplateId === "custom") {
      const subId = createSubscriptionListId.trim() || null;
      const actions: ActionConfig[] = [];
      if (customActionType === "alert") {
        actions.push({ type: "alert", severity: "warning", subscriptionListId: subId });
      } else {
        actions.push({ type: "block", reasonTemplate: "Custom policy violation" });
      }
      return {
        trigger: customTrigger,
        conditions: customConditions,
        actions,
      };
    }

    const template = POLICY_TEMPLATES.find((t) => t.id === createTemplateId);
    if (!template) return null;
    const config: PolicyConfig = JSON.parse(JSON.stringify(template.config));

    const subId = createSubscriptionListId.trim() || null;
    for (const a of config.actions) {
      if (a.type === "alert" && subId) a.subscriptionListId = subId;
    }

    const needsListId =
      createTemplateId === "allowlist" || createTemplateId === "to_exchange" || createTemplateId === "exchange_tx_monitor";
    if (needsListId && createListId) {
      for (const c of config.conditions) {
        if ("listId" in c && c.listId === "") (c as { listId: string }).listId = createListId;
      }
    }

    const needsAmount =
      createTemplateId === "large_tx_usd" || createTemplateId === "approval_amount_threshold";
    if (needsAmount && createAmountUsd.trim()) {
      const value = parseFloat(createAmountUsd);
      if (Number.isFinite(value) && value >= 0) {
        for (const c of config.conditions) {
          if ("value" in c) (c as { value: number }).value = value;
        }
      }
    }

    // Inject time window for time_of_day template
    if (createTemplateId === "time_of_day") {
      for (const c of config.conditions) {
        if (c.type === "time_of_day" && "window" in c) {
          (c as { window: { start: string; end: string; timezone: string } }).window = {
            start: createTimeStart || "00:00",
            end: createTimeEnd || "06:00",
            timezone: createTimeTz || "UTC",
          };
        }
      }
    }

    return config;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    const config = buildConfigFromTemplate();
    if (!config) {
      setCreateError("Invalid template");
      return;
    }
    if (needsAddressList && (createTemplateId as string) !== "custom") {
      if (!createListId.trim()) {
        setCreateError("Please select an address list.");
        return;
      }
    }
    if (
      createTemplateId !== "custom" &&
      (createTemplateId === "large_tx_usd" || createTemplateId === "approval_amount_threshold") &&
      (!createAmountUsd.trim() || parseFloat(createAmountUsd) < 0)
    ) {
      setCreateError("Enter a valid amount (USD).");
      return;
    }
    setCreateSubmitting(true);
    try {
      const res = await fetch("/api/org/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          type: createTemplateId,
          scope: createScope,
          safeId: createScope === "safe" ? createSafeId || null : null,
          config,
          subscriptionListId: createSubscriptionListId || null,
          enabled: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create policy");
        return;
      }
      setCreateOpen(false);
      setCreateName("");
      setCreateTemplateId(POLICY_TEMPLATES[0]?.id ?? "multisig_activity");
      setCreateScope("org");
      setCreateSafeId("");
      setCreateSubscriptionListId("");
      setCreateListId("");
      setCreateAmountUsd("");
      await fetchPolicies();
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this policy?")) return;
    try {
      const res = await fetch(`/api/org/policies/${id}`, { method: "DELETE" });
      if (res.ok) await fetchPolicies();
    } catch {
      // ignore
    }
  }

  async function fetchEnforcementLogs() {
    setEnforcementLoading(true);
    try {
      const res = await fetch("/api/org/policies/enforcement-logs?limit=100");
      if (res.ok) {
        const data = await res.json();
        setEnforcementLogs(data.enforcementLogs ?? []);
        setEnforcementPage(1);
      }
    } finally {
      setEnforcementLoading(false);
    }
  }

  async function handlePreview() {
    const config = buildConfigFromTemplate();
    if (!config) return;
    setPreviewLoading(true);
    setPreviewResult(null);
    setCreateError(null);
    try {
      const res = await fetch("/api/org/policies/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyConfig: config,
          dryRun: true,
          lookbackDays: 30,
          scope: createScope,
          safeId: createScope === "safe" ? createSafeId || undefined : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "Preview failed");
        return;
      }
      setPreviewResult(data);
    } catch {
      setCreateError("Network error during preview");
    } finally {
      setPreviewLoading(false);
    }
  }

  const selectedTemplate = POLICY_TEMPLATES.find((t) => t.id === createTemplateId);
  const needsAddressList =
    createTemplateId === "allowlist" || createTemplateId === "to_exchange" || createTemplateId === "exchange_tx_monitor";
  const needsAmount =
    createTemplateId === "large_tx_usd" ||
    createTemplateId === "approval_amount_threshold" ||
    createTemplateId === "exchange_tx_monitor";
  const needsTimeWindow = createTemplateId === "time_of_day";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Advanced Policy Control Center</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Manage organization-wide multisig orchestration. Policies evaluate triggers, conditions, and actions to define real-time transaction blocking and alerting.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className={cn(
            "inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground",
            "hover:bg-primary/90 shadow-lg shadow-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          )}
        >
          <Plus className="h-4 w-4" aria-hidden />
          New policy
        </button>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="create-policy-title">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <h2 id="create-policy-title" className="text-lg font-semibold text-foreground">New policy</h2>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label htmlFor="create-name" className="block text-sm font-medium text-foreground">Name</label>
                <input
                  id="create-name"
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Large transfers"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  required
                />
              </div>
              <div>
                <label htmlFor="create-template" className="block text-sm font-medium text-foreground">Template</label>
                <select
                  id="create-template"
                  value={createTemplateId}
                  onChange={(e) => setCreateTemplateId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  {POLICY_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                  <option value="custom">Custom (visual composer)</option>
                </select>
                {createTemplateId === "custom" ? (
                  <p className="mt-1 text-xs text-muted-foreground">Build a custom policy with visual condition composer.</p>
                ) : selectedTemplate ? (
                  <p className="mt-1 text-xs text-muted-foreground">{selectedTemplate.description}</p>
                ) : null}
              </div>

              {/* Custom composer fields */}
              {createTemplateId === "custom" && (
                <>
                  <div>
                    <label htmlFor="custom-trigger" className="block text-sm font-medium text-foreground">Trigger</label>
                    <select
                      id="custom-trigger"
                      value={customTrigger}
                      onChange={(e) => setCustomTrigger(e.target.value as "pending_tx" | "config_change" | "balance_change")}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    >
                      <option value="pending_tx">Pending Transaction</option>
                      <option value="config_change">Config / Owner Change</option>
                      <option value="balance_change">Balance Change</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="custom-action" className="block text-sm font-medium text-foreground">Primary Action</label>
                    <select
                      id="custom-action"
                      value={customActionType}
                      onChange={(e) => setCustomActionType(e.target.value as "alert" | "block")}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    >
                      <option value="alert">Alert (notify only)</option>
                      <option value="block">Block (violation)</option>
                    </select>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/10 p-3">
                    <ConditionComposer
                      conditions={customConditions}
                      onChange={setCustomConditions}
                      addressLists={addressLists}
                    />
                  </div>
                </>
              )}
              <div>
                <label htmlFor="create-scope" className="block text-sm font-medium text-foreground">Scope</label>
                <select
                  id="create-scope"
                  value={createScope}
                  onChange={(e) => setCreateScope(e.target.value as "org" | "safe")}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  <option value="org">All Safes (org)</option>
                  <option value="safe">Single Safe</option>
                </select>
              </div>
              {needsAmount && (
                <div>
                  <label htmlFor="create-amount-usd" className="block text-sm font-medium text-foreground">Threshold (USD)</label>
                  <input
                    id="create-amount-usd"
                    type="number"
                    min={0}
                    step={0.01}
                    value={createAmountUsd}
                    onChange={(e) => setCreateAmountUsd(e.target.value)}
                    placeholder="e.g. 10000"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pending native transfers above this USD value (at current rate) will trigger the policy.
                  </p>
                </div>
              )}
              {needsTimeWindow && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Time window</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Alert when a pending transaction occurs during this time window.
                    Set overnight hours (e.g. 00:00–06:00) to catch unusual activity,
                    or business hours (e.g. 09:00–17:00) for monitoring during the workday.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="create-time-start" className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Start</label>
                      <input
                        id="create-time-start"
                        type="time"
                        value={createTimeStart}
                        onChange={(e) => setCreateTimeStart(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                      />
                    </div>
                    <div>
                      <label htmlFor="create-time-end" className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">End</label>
                      <input
                        id="create-time-end"
                        type="time"
                        value={createTimeEnd}
                        onChange={(e) => setCreateTimeEnd(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <label htmlFor="create-time-tz" className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Timezone</label>
                    <input
                      id="create-time-tz"
                      type="text"
                      value={createTimeTz}
                      onChange={(e) => setCreateTimeTz(e.target.value)}
                      placeholder="UTC"
                      className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">IANA timezone, e.g. UTC, America/New_York, Europe/London</p>
                  </div>
                </div>
              )}
              {needsAddressList && (
                <div>
                  <label htmlFor="create-list" className="block text-sm font-medium text-foreground">Address list</label>
                  <select
                    id="create-list"
                    value={createListId}
                    onChange={(e) => setCreateListId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    required
                  >
                    <option value="">Select list</option>
                    {addressLists.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {createTemplateId === "allowlist"
                      ? "Only destinations in this list are allowed; others are blocked and trigger an alert."
                      : "Destinations in this list will trigger an alert."}
                  </p>
                </div>
              )}
              {createScope === "safe" && (
                <div>
                  <label htmlFor="create-safe" className="block text-sm font-medium text-foreground">Safe</label>
                  <select
                    id="create-safe"
                    value={createSafeId}
                    onChange={(e) => setCreateSafeId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    required
                  >
                    <option value="">Select Safe</option>
                    {safes.map((s) => (
                      <option key={s.id} value={s.id}>{s.name ?? s.address}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="create-subscription" className="block text-sm font-medium text-foreground">Notify (subscription list)</label>
                <select
                  id="create-subscription"
                  value={createSubscriptionListId}
                  onChange={(e) => setCreateSubscriptionListId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  <option value="">None</option>
                  {subscriptionLists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name} {l.memberCount != null ? `(${l.memberCount})` : ""}</option>
                  ))}
                </select>
              </div>
              {createError && <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>}
              {previewResult && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground">Impact Preview (30 days)</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div><span className="font-medium text-foreground">{previewResult.safesEvaluated}</span> safes evaluated</div>
                    <div><span className="font-medium text-foreground">{previewResult.transactionsEvaluated}</span> txs evaluated</div>
                    <div><span className="font-medium text-orange-500">{previewResult.alertsThatWouldHaveFired}</span> alerts</div>
                    <div><span className="font-medium text-red-500">{previewResult.violationsThatWouldHaveBlocked}</span> blocks</div>
                  </div>
                  {previewResult.samples.length > 0 && (
                    <div className="text-[10px] text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">Sample matches:</p>
                      {previewResult.samples.map((s, i) => (
                        <p key={i}>{s.safeName ?? "—"}: {s.to ? `${s.to.slice(0, 8)}…` : ""} — {s.reason}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2 justify-end">\n                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={previewLoading || !createName.trim() || (createScope === "safe" && !createSafeId)}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {previewLoading ? "Running..." : <><BarChart3 className="h-3.5 w-3.5" /> Preview impact</>}
                </button>
                <button
                  type="button"
                  onClick={() => { setCreateOpen(false); setCreateError(null); setPreviewResult(null); }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    createSubmitting ||
                    !createName.trim() ||
                    (createScope === "safe" && !createSafeId) ||
                    (needsAddressList && !createListId) ||
                    (needsAmount && (!createAmountUsd.trim() || parseFloat(createAmountUsd) < 0))
                  }
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {createSubmitting ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading policies…</p>
      ) : policies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 py-12 px-6 text-center">
          <FileCheck className="mx-auto h-12 w-12 text-muted-foreground/60" aria-hidden />
          <p className="mt-4 text-sm font-medium text-foreground">No policies yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create a policy from a template (trigger, conditions, actions).</p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New policy
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-xl border border-border bg-card">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Policies</span>
                <Shield className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">{activePolicies.length}</span>
                {thisWeek > 0 && (
                  <span className="text-[10px] font-bold text-emerald-500">+{thisWeek} this week</span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Protecting {safesList.length} multisig safe{safesList.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="p-5 rounded-xl border border-border bg-card">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Triggers Fired (24h)</span>
                <Zap className="h-5 w-5 text-orange-400" aria-hidden />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">—</span>
                <span className="text-[10px] text-muted-foreground font-medium">—</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Trigger counts coming soon</p>
            </div>
            <div className="p-5 rounded-xl border border-border bg-card">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Compliance Health</span>
                <CheckCircle className="h-5 w-5 text-emerald-500" aria-hidden />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">—</span>
                <span className="text-[10px] text-muted-foreground font-bold">Audit Standard</span>
              </div>
              <div className="w-full bg-muted h-1 rounded-full mt-3 overflow-hidden">
                <div className="bg-emerald-500 h-full w-0" aria-hidden />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Policy Name</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Severity</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Type / Logic</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Primary Action</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Safe Coverage</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Last Fired</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Enabled</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedPolicies.map((p) => {
                    const severity = getSeverity(p);
                    const action = getPrimaryAction(p);
                    return (
                      <tr key={p.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-2 h-2 rounded-full shrink-0", SEVERITY_DOT[severity])} aria-hidden />
                            <div>
                              <Link href={`/dashboard/controls/policies/${p.id}`} className="text-sm font-semibold text-primary hover:underline">
                                {p.name}
                              </Link>
                              <p className="text-[10px] text-muted-foreground">ID: {policyDisplayId(p.id)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border", SEVERITY_STYLES[severity])}>
                            {severity === "critical" ? "Critical" : severity === "high" ? "High" : "Info"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-foreground">{policyTypeLabel(p.type)}</p>
                          <p className="text-[10px] text-muted-foreground italic">{getConditionSummary(p)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {action.icon === "block" && <Ban className="h-3.5 w-3.5 text-red-500" aria-hidden />}
                            {action.icon === "alert" && <Bell className="h-3.5 w-3.5 text-orange-400" aria-hidden />}
                            {action.icon === "log" && <FileText className="h-3.5 w-3.5 text-blue-400" aria-hidden />}
                            <span className="text-xs font-medium">{action.label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {p.scope === "org" ? (
                            <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded border border-border">Org-wide</span>
                          ) : p.safeId && safeNameById[p.safeId] ? (
                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">{safeNameById[p.safeId]}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">1 Safe</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {p.lastFiredAt ? (
                            <span className="text-xs text-muted-foreground">
                              {new Date(p.lastFiredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              {" "}
                              <span className="text-[10px]">
                                {new Date(p.lastFiredAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </span>
                          ) : (
                            <p className="text-xs text-muted-foreground">—</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn("text-xs font-bold", p.enabled ? "text-emerald-500" : "text-muted-foreground")}>
                            {p.enabled ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link
                              href={`/dashboard/controls/policies/${p.id}`}
                              className="text-muted-foreground hover:text-primary"
                              aria-label="Edit policy"
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDelete(p.id)}
                              className="text-muted-foreground hover:text-red-500"
                              aria-label="Delete policy"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 bg-muted/20 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
              <p>Showing {paginatedPolicies.length} of {policies.length} policies</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="px-2 py-1 rounded border border-border disabled:opacity-50 hover:bg-muted/50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                  className="px-2 py-1 rounded border border-border disabled:opacity-50 hover:bg-muted/50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Enforcement Log ──────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => {
            const toggled = !showEnforcementLog;
            setShowEnforcementLog(toggled);
            if (toggled && enforcementLogs.length === 0) fetchEnforcementLogs();
          }}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">Recent Enforcement</p>
              <p className="text-[10px] text-muted-foreground">Policy fires from the last poll cycles</p>
            </div>
          </div>
          {showEnforcementLog ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {showEnforcementLog && (
          <div className="border-t border-border">
            {enforcementLoading ? (
              <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading enforcement log…
              </div>
            ) : enforcementLogs.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <History className="mx-auto h-8 w-8 text-muted-foreground/60" />
                <p className="mt-2 text-sm text-muted-foreground">No enforcement events yet.</p>
                <p className="text-xs text-muted-foreground">Policy fires will appear here after the next poll cycle.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Time</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Policy</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Safe</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Action</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reason</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notified</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {enforcementLogs.slice((enforcementPage - 1) * ENFORCEMENT_PAGE_SIZE, enforcementPage * ENFORCEMENT_PAGE_SIZE).map((entry) => {
                        const details = (entry.actionDetails ?? {}) as Record<string, unknown>;
                        const isBlock = entry.actionType === "block";
                        return (
                          <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <p className="text-xs text-foreground">
                                {new Date(entry.firedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(entry.firedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-medium text-foreground">{entry.policyName}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-mono text-muted-foreground">
                                {entry.safeName ?? entry.safeAddress.slice(0, 8) + "…"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                                isBlock ? "bg-red-100 dark:bg-red-900/30 text-red-600" : "bg-orange-100 dark:bg-orange-900/30 text-orange-600"
                              )}>
                                {isBlock ? <Ban className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
                                {isBlock ? "Blocked" : "Alert"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] text-muted-foreground">
                                {details.reason ? String(details.reason) : entry.triggerType}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {entry.notificationSent ? (
                                <span className="text-[10px] text-emerald-500 font-medium">Sent</span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {enforcementLogs.length > ENFORCEMENT_PAGE_SIZE && (
                  <div className="px-4 py-3 bg-muted/20 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                    <p>Showing {Math.min(ENFORCEMENT_PAGE_SIZE, enforcementLogs.length - (enforcementPage - 1) * ENFORCEMENT_PAGE_SIZE)} of {enforcementLogs.length} events</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEnforcementPage((p) => Math.max(1, p - 1))}
                        disabled={enforcementPage <= 1}
                        className="px-2 py-1 rounded border border-border disabled:opacity-50 hover:bg-muted/50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnforcementPage((p) => Math.min(Math.ceil(enforcementLogs.length / ENFORCEMENT_PAGE_SIZE), p + 1))}
                        disabled={enforcementPage >= Math.ceil(enforcementLogs.length / ENFORCEMENT_PAGE_SIZE)}
                        className="px-2 py-1 rounded border border-border disabled:opacity-50 hover:bg-muted/50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
