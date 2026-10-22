"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Bell, Plus, Trash2, AlertCircle, Loader2, CheckCircle, RotateCw, Send, X, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { SAFE_CHAINS } from "@/lib/safe-api";
import { CreateTriggerModal } from "./create-trigger-modal";
import { AddRecipientListModal } from "./add-recipient-list-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";

function truncateAddress(addr: string, start = 6, end = 4): string {
  if (addr.length <= start + end) return addr;
  return `${addr.slice(0, start)}…${addr.slice(-end)}`;
}

function ruleTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    pending_tx: "Pending tx",
    queue_stuck: "Queue stuck",
    signer_change: "Signer change",
    threshold_decreased: "Threshold decreased",
    signer_count_decreased: "Signer count decreased",
    config_change_critical: "Critical config change",
    unverified_signers: "Unverified signers",
    missing_external_signer: "Missing external signer",
    signer_eoa_activity: "Signer EOA activity",
    verification_expiring: "Verification expiring",
    pending_tx_unreviewed: "Pending tx unreviewed",
    oob_verification_overdue: "OOB verification overdue",
    oob_verification_required: "OOB verification required",
    security_incident_reported: "Security incident reported",
    balance_change_pct: "Balance change %",
    balance_change_abs: "Balance change abs",
  };
  return labels[type] ?? type;
}

type Rule = {
  id: string;
  orgId: string;
  safeId: string | null;
  subscriptionListId: string | null;
  type: string;
  config: Record<string, unknown>;
  name: string | null;
  createdAt: string;
};

type SubscriptionListWithCount = {
  id: string;
  organizationId: string;
  name: string;
  createdAt: string;
  memberCount: number;
};

type FiringAlert = {
  ruleId: string;
  ruleName: string | null;
  ruleType: string;
  safeId: string;
  safeName: string | null;
  safeAddress: string;
  network: string;
  reason: string;
};

type SafeOption = { id: string; name: string | null; address: string; network: string };

type Subscription = {
  id: string;
  safeId: string | null;
  subscriptionListId: string | null;
  eventType: string;
  channel: "email" | "slack";
  channelConfig: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
};

function eventTypeLabel(eventType: string): string {
  const labels: Record<string, string> = {
    SIGNER_ADD_PROPOSED: "Signer add proposed",
    SIGNER_REMOVE_PROPOSED: "Signer remove proposed",
    THRESHOLD_CHANGE_PROPOSED: "Threshold change proposed",
    SIGNER_SWAP_PROPOSED: "Signer swap proposed",
    GUARD_SET_PROPOSED: "Guard set proposed",
    FALLBACK_HANDLER_SET_PROPOSED: "Fallback handler set proposed",
    MODULE_CHANGE_PROPOSED: "Module change proposed",
    ERC20_TRANSFER_PROPOSED: "ERC20 transfer proposed",
    ERC20_APPROVAL_PROPOSED: "ERC20 approval proposed",
    ERC20_TRANSFER_FROM_PROPOSED: "ERC20 transferFrom proposed",
    ETH_TRANSFER_PROPOSED: "ETH transfer proposed",
    CONTRACT_CALL_PROPOSED: "Contract call proposed",
  };
  return labels[eventType] ?? eventType;
}

type TabId = "overview" | "triggers" | "recipients";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "triggers", label: "Triggers" },
  { id: "recipients", label: "Recipients" },
];

export function AlertsClient() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [rules, setRules] = useState<Rule[]>([]);
  const [firing, setFiring] = useState<FiringAlert[]>([]);
  const [safes, setSafes] = useState<SafeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  type ConfirmPending =
    | { kind: "rule"; id: string; ruleLabel: string }
    | { kind: "sub"; id: string }
    | { kind: "list"; id: string; name: string };
  const [confirmPending, setConfirmPending] = useState<ConfirmPending | null>(null);

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [subDeleteId, setSubDeleteId] = useState<string | null>(null);
  const [listDeleteId, setListDeleteId] = useState<string | null>(null);
  const [subTogglingId, setSubTogglingId] = useState<string | null>(null);
  const [subTestId, setSubTestId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [subscriptionLists, setSubscriptionLists] = useState<SubscriptionListWithCount[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [addRecipientModalOpen, setAddRecipientModalOpen] = useState(false);

  const fetchRules = useCallback(async () => {
    const res = await fetch("/api/alerts/rules");
    if (!res.ok) return;
    const data = await res.json();
    setRules(data.rules ?? []);
  }, []);

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    const res = await fetch("/api/alerts/status");
    setStatusLoading(false);
    if (!res.ok) return;
    const data = await res.json();
    setFiring(data.firing ?? []);
  }, []);

  const fetchSafes = useCallback(async () => {
    const res = await fetch("/api/safes");
    if (!res.ok) return;
    const data = await res.json();
    const list = (data.safes ?? []).map((s: { id: string; name: string | null; address: string; network: string }) => ({
      id: s.id,
      name: s.name ?? null,
      address: s.address,
      network: s.network,
    }));
    setSafes(list);
  }, []);

  const fetchSubscriptions = useCallback(async () => {
    setSubsLoading(true);
    const res = await fetch("/api/alerts/subscriptions");
    setSubsLoading(false);
    if (!res.ok) return;
    const data = await res.json();
    setSubscriptions(data.subscriptions ?? []);
  }, []);

  const fetchSubscriptionLists = useCallback(async () => {
    setListsLoading(true);
    const res = await fetch("/api/alerts/subscription-lists");
    setListsLoading(false);
    if (!res.ok) return;
    const data = await res.json();
    setSubscriptionLists(data.lists ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.all([fetchRules(), fetchSafes(), fetchSubscriptions(), fetchSubscriptionLists()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchRules, fetchSafes, fetchSubscriptions, fetchSubscriptionLists]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleDeleteClick = (id: string, ruleLabel: string) => {
    setConfirmPending({ kind: "rule", id, ruleLabel });
  };

  const handleDeleteConfirm = async () => {
    const p = confirmPending;
    if (!p) return;
    if (p.kind === "rule") {
      setDeleteId(p.id);
      try {
        const res = await fetch(`/api/alerts/rules/${p.id}`, { method: "DELETE" });
        if (res.ok) {
          await fetchRules();
          await fetchStatus();
        }
      } finally {
        setDeleteId(null);
      }
    } else if (p.kind === "sub") {
      setSubDeleteId(p.id);
      try {
        const res = await fetch(`/api/alerts/subscriptions/${p.id}`, { method: "DELETE" });
        if (res.ok) await fetchSubscriptions();
      } finally {
        setSubDeleteId(null);
      }
    } else {
      setListDeleteId(p.id);
      try {
        const res = await fetch(`/api/alerts/subscription-lists/${p.id}`, { method: "DELETE" });
        if (res.ok) await fetchSubscriptionLists();
      } finally {
        setListDeleteId(null);
      }
    }
  };

  const handleToggleSubscription = async (sub: Subscription) => {
    setSubTogglingId(sub.id);
    try {
      const res = await fetch(`/api/alerts/subscriptions/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !sub.enabled }),
      });
      if (res.ok) await fetchSubscriptions();
    } finally {
      setSubTogglingId(null);
    }
  };

  const handleDeleteSubscriptionClick = (id: string) => {
    setConfirmPending({ kind: "sub", id });
  };

  const handleDeleteSubscriptionListClick = (id: string, name: string) => {
    setConfirmPending({ kind: "list", id, name });
  };

  const handleTestSubscription = async (id: string) => {
    setSubTestId(id);
    setToast(null);
    try {
      const res = await fetch(`/api/alerts/subscriptions/${id}/test`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setToast({ type: "success", message: "Test sent! Check your inbox (or Slack)." });
      } else {
        setToast({ type: "error", message: data.error ?? "Failed to send test." });
      }
    } finally {
      setSubTestId(null);
    }
  };

  const networkName = (slug: string) => SAFE_CHAINS.find((c) => c.slug === slug)?.name ?? slug;

  if (loading) {
    return (
      <div className="min-w-0 space-y-4">
        <header className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Alerts</h1>
          <p className="text-sm text-muted-foreground">Triggers, recipients, and what&apos;s firing now</p>
        </header>
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  const triggerCount = rules.length + subscriptions.length;
  const recipientCount = subscriptionLists.length;

  const confirmTitle =
    confirmPending?.kind === "rule"
      ? `Delete rule "${confirmPending.ruleLabel}"?`
      : confirmPending?.kind === "sub"
        ? "Remove this notification?"
        : confirmPending?.kind === "list"
          ? `Delete recipient list "${confirmPending.name}"?`
          : "";
  const confirmDescription =
    confirmPending?.kind === "list"
      ? "Triggers using it will no longer send emails."
      : undefined;
  const confirmLoading = deleteId !== null || subDeleteId !== null || listDeleteId !== null;

  return (
    <div className="min-w-0 space-y-4">
      <ConfirmDialog
        open={confirmPending !== null}
        onClose={() => setConfirmPending(null)}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        destructive
        loading={confirmLoading}
      />
      <header className="space-y-3">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Alerts</h1>
          <p className="text-sm text-muted-foreground">Triggers, recipients, and what&apos;s firing now</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground tabular-nums">{triggerCount}</span> trigger{triggerCount !== 1 ? "s" : ""}
          </span>
          <span className="text-border" aria-hidden>·</span>
          <span>
            <span className="font-medium text-foreground tabular-nums">{recipientCount}</span> recipient list{recipientCount !== 1 ? "s" : ""}
          </span>
          <span className="text-border" aria-hidden>·</span>
          <span>
            {statusLoading ? (
              "Checking status…"
            ) : (
              <>
                <span className={cn("font-medium tabular-nums", firing.length > 0 ? "text-primary" : "text-foreground")}>
                  {firing.length}
                </span>{" "}
                firing
              </>
            )}
          </span>
        </div>
        <div
          role="tablist"
          aria-label="Alerts sections"
          className="inline-flex flex-wrap gap-1 rounded-lg border border-border/60 bg-muted/30 p-1"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`alerts-panel-${tab.id}`}
              id={`alerts-tab-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {toast && (
        <div
          role="alert"
          className={cn(
            "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm",
            toast.type === "success"
              ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400 dark:border-green-400/30 dark:bg-green-400/10"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle className="h-5 w-5 shrink-0" aria-hidden />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
          )}
          <p className="flex-1 min-w-0 text-sm font-medium">{toast.message}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded-md p-1.5 text-current opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {activeTab === "overview" && (
      <section
        id="alerts-panel-overview"
        role="tabpanel"
        aria-labelledby="alerts-tab-overview"
        className="rounded-lg border border-border/80 bg-card overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/80 px-4 py-3">
          <h2 id="alerts-overview-heading" className="text-sm font-medium text-foreground">
            Active alerts
          </h2>
          <button
            type="button"
            onClick={() => fetchStatus()}
            disabled={statusLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            aria-label="Refresh firing status"
          >
            {statusLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden /> : <RotateCw className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          {statusLoading ? (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/80 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5">Rule</th>
                  <th className="px-4 py-2.5">Safe</th>
                  <th className="px-4 py-2.5">Network</th>
                  <th className="px-4 py-2.5">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {[1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><span className="inline-block h-3.5 w-20 rounded bg-muted/50" aria-hidden /></td>
                    <td className="px-4 py-3"><span className="inline-block h-3.5 w-28 rounded bg-muted/50" aria-hidden /></td>
                    <td className="px-4 py-3"><span className="inline-block h-3.5 w-14 rounded bg-muted/50" aria-hidden /></td>
                    <td className="px-4 py-3"><span className="inline-block h-3.5 w-32 rounded bg-muted/50" aria-hidden /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : firing.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
              <CheckCircle className="h-9 w-9 text-muted-foreground/50" aria-hidden />
              <p className="mt-3 text-sm font-medium text-foreground">Nothing firing</p>
              <p className="mt-1 text-xs text-muted-foreground">Matching triggers will show up here.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/80 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5">Rule</th>
                  <th className="px-4 py-2.5">Safe</th>
                  <th className="px-4 py-2.5">Network</th>
                  <th className="px-4 py-2.5">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {firing.map((a) => (
                  <tr key={`${a.ruleId}-${a.safeId}`} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {a.ruleName || ruleTypeLabel(a.ruleType)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <Link
                        href={`/dashboard/safes/${a.safeId}`}
                        className="font-medium text-foreground hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded-sm"
                      >
                        {a.safeName || truncateAddress(a.safeAddress)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{networkName(a.network)}</td>
                    <td className="px-4 py-3 text-xs text-primary">{a.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
      )}

      {activeTab === "triggers" && (
      <section
        id="alerts-panel-triggers"
        role="tabpanel"
        aria-labelledby="alerts-tab-triggers"
        className="space-y-3"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="alerts-triggers-heading" className="text-sm font-medium text-foreground">
            Triggers
          </h2>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 min-h-[36px]"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
            New trigger
          </button>
        </div>
        <div className="rounded-lg border border-border/80 bg-card overflow-hidden">
          {rules.length === 0 && subscriptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
              <Bell className="h-9 w-9 text-muted-foreground/50" aria-hidden />
              <p className="mt-3 text-sm font-medium text-foreground">No triggers yet</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">Add a recipient list first if you want email on first fire.</p>
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 min-h-[36px]"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                New trigger
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="border-b border-border/80">
                    <tr className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5">Name</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5 hidden sm:table-cell">Condition</th>
                      <th className="px-4 py-2.5 hidden md:table-cell">Scope</th>
                      <th className="px-4 py-2.5 hidden lg:table-cell">Recipients</th>
                      <th className="px-4 py-2.5">On</th>
                      <th className="w-16 px-2 py-2.5" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {rules.map((r) => {
                      const safe = r.safeId ? safes.find((s) => s.id === r.safeId) : null;
                      const list = r.subscriptionListId ? subscriptionLists.find((l) => l.id === r.subscriptionListId) : null;
                      const conditionDesc =
                        r.type === "pending_tx"
                          ? `pending_tx >= ${(r.config as { minCount?: number }).minCount ?? 0}`
                          : r.type === "queue_stuck"
                            ? `stuck > ${(r.config as { days?: number }).days ?? 3} days`
                            : r.type;
                      const scopeDesc = r.safeId ? (safe ? (safe.name || truncateAddress(safe.address)) : "One safe") : "All safes";
                      const ruleLabel = r.name || ruleTypeLabel(r.type);
                      return (
                        <tr key={`rule-${r.id}`} className="hover:bg-muted/30 transition-colors group">
                          <td className="px-4 py-3">
                            <span className="font-medium text-foreground">{ruleLabel}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] text-muted-foreground">Rule</span>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell text-xs font-mono text-muted-foreground">{conditionDesc}</td>
                          <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">{scopeDesc}</td>
                          <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground truncate max-w-[8rem]">
                            {list ? list.name : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] font-medium text-primary">On</span>
                          </td>
                          <td className="px-2 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(r.id, ruleLabel)}
                              disabled={deleteId === r.id}
                              className="p-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                              aria-label={`Delete ${ruleLabel}`}
                            >
                              {deleteId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden /> : <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {subscriptions.map((sub) => {
                      const safe = sub.safeId ? safes.find((s) => s.id === sub.safeId) : null;
                      const scopeDesc = sub.safeId ? (safe ? (safe.name || truncateAddress(safe.address)) : "One safe") : "All safes";
                      const list = sub.subscriptionListId ? subscriptionLists.find((l) => l.id === sub.subscriptionListId) : null;
                      return (
                        <tr key={`sub-${sub.id}`} className="hover:bg-muted/30 transition-colors group">
                          <td className="px-4 py-3">
                            <span className="font-medium text-foreground">{eventTypeLabel(sub.eventType)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] text-muted-foreground">Event</span>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground">{sub.channel}</td>
                          <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">{scopeDesc}</td>
                          <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground truncate max-w-[8rem]">
                            {list ? list.name : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleToggleSubscription(sub)}
                              disabled={subTogglingId === sub.id}
                              className={cn(
                                "relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                                sub.enabled ? "bg-primary" : "bg-muted"
                              )}
                              aria-label={sub.enabled ? "Turn off" : "Turn on"}
                            >
                              <span
                                className={cn(
                                  "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition",
                                  sub.enabled ? "translate-x-3" : "translate-x-0.5"
                                )}
                              />
                            </button>
                          </td>
                          <td className="px-2 py-3 text-right">
                            <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                              <button
                                type="button"
                                onClick={() => handleTestSubscription(sub.id)}
                                disabled={subTestId === sub.id}
                                className="p-1 rounded text-muted-foreground hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                                aria-label="Send test"
                              >
                                {subTestId === sub.id ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden /> : <Send className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSubscriptionClick(sub.id)}
                                disabled={subDeleteId === sub.id}
                                className="p-1 rounded text-muted-foreground hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                                aria-label="Delete"
                              >
                                {subDeleteId === sub.id ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden /> : <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>
      )}

      <CreateTriggerModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          fetchRules();
          fetchSubscriptions();
          fetchStatus();
          setCreateModalOpen(false);
        }}
      />

      {activeTab === "recipients" && (
      <section
        id="alerts-panel-recipients"
        role="tabpanel"
        aria-labelledby="alerts-tab-recipients"
        className="space-y-3"
      >
        <div className="rounded-lg border border-border/80 bg-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border/80 px-4 py-3">
            <h2 id="alerts-recipients-heading" className="text-sm font-medium text-foreground">
              Recipient lists
            </h2>
            <button
              type="button"
              onClick={() => setAddRecipientModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 min-h-[36px]"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Add list
            </button>
          </div>
          <div className="overflow-x-auto">
            {listsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 px-4">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                <span>Loading…</span>
              </div>
            ) : subscriptionLists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                <Users className="h-9 w-9 text-muted-foreground/50" aria-hidden />
                <p className="mt-3 text-sm font-medium text-foreground">No recipient lists</p>
                <p className="mt-1 text-xs text-muted-foreground">Create one to assign to triggers.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Members</th>
                    <th className="px-4 py-2.5 hidden sm:table-cell">Triggers</th>
                    <th className="w-12 px-2 py-2.5" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {subscriptionLists.map((list) => {
                    const ruleNames = rules.filter((r) => r.subscriptionListId === list.id).map((r) => r.name ?? ruleTypeLabel(r.type));
                    const subLabels = subscriptions.filter((s) => s.subscriptionListId === list.id).map((s) => eventTypeLabel(s.eventType));
                    const associatedCount = ruleNames.length + subLabels.length;
                    return (
                      <tr key={list.id} className="group hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{list.name}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                          {list.memberCount} email{list.memberCount !== 1 ? "s" : ""}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground">
                          {associatedCount === 0 ? "—" : `${associatedCount} linked`}
                        </td>
                        <td className="px-2 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteSubscriptionListClick(list.id, list.name)}
                            disabled={listDeleteId === list.id}
                            className="p-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                            aria-label={`Delete list ${list.name}`}
                          >
                            {listDeleteId === list.id ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden /> : <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
      )}

      <AddRecipientListModal
        open={addRecipientModalOpen}
        onClose={() => setAddRecipientModalOpen(false)}
        onSuccess={() => {
          fetchSubscriptionLists();
          setAddRecipientModalOpen(false);
        }}
      />
    </div>
  );
}
