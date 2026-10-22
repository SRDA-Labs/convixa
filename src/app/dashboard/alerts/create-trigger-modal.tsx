"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  X,
  Loader2,
  PlusCircle,
} from "lucide-react";
import { SAFE_CHAINS } from "@/lib/safe-api";

const SUBSCRIPTION_EVENT_TYPES = [
  "SIGNER_ADD_PROPOSED",
  "SIGNER_REMOVE_PROPOSED",
  "THRESHOLD_CHANGE_PROPOSED",
  "SIGNER_SWAP_PROPOSED",
  "GUARD_SET_PROPOSED",
  "FALLBACK_HANDLER_SET_PROPOSED",
  "MODULE_CHANGE_PROPOSED",
  "ERC20_TRANSFER_PROPOSED",
  "ETH_TRANSFER_PROPOSED",
  "CONTRACT_CALL_PROPOSED",
] as const;

function eventTypeLabel(eventType: string): string {
  const labels: Record<string, string> = {
    SIGNER_ADD_PROPOSED: "Signer add proposed",
    SIGNER_REMOVE_PROPOSED: "Signer remove proposed",
    THRESHOLD_CHANGE_PROPOSED: "Threshold change proposed",
    SIGNER_SWAP_PROPOSED: "Signer swap proposed",
    ERC20_TRANSFER_PROPOSED: "ERC20 transfer proposed",
    ETH_TRANSFER_PROPOSED: "ETH transfer proposed",
    CONTRACT_CALL_PROPOSED: "Contract call proposed",
    GUARD_SET_PROPOSED: "Guard set proposed",
    FALLBACK_HANDLER_SET_PROPOSED: "Fallback handler set proposed",
    MODULE_CHANGE_PROPOSED: "Module change proposed",
  };
  return labels[eventType] ?? eventType;
}

function truncateAddress(addr: string, start = 6, end = 4): string {
  if (addr.length <= start + end) return addr;
  return `${addr.slice(0, start)}…${addr.slice(-end)}`;
}

type SafeOption = { id: string; name: string | null; address: string; network: string };
type SubscriptionListWithCount = { id: string; name: string; memberCount: number };

export function CreateTriggerModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [kind, setKind] = useState<"condition" | "event">("condition");
  const [formType, setFormType] = useState<
    | "pending_tx"
    | "queue_stuck"
    | "signer_change"
    | "threshold_decreased"
    | "signer_count_decreased"
    | "config_change_critical"
    | "unverified_signers"
    | "missing_external_signer"
    | "signer_eoa_activity"
    | "verification_expiring"
    | "pending_tx_unreviewed"
    | "oob_verification_overdue"
    | "oob_verification_required"
    | "security_incident_reported"
  >("pending_tx");
  const [formSafeId, setFormSafeId] = useState("");
  const [formName, setFormName] = useState("");
  const [formMinCount, setFormMinCount] = useState(1);
  const [formDays, setFormDays] = useState(3);
  const [formCriticalHours, setFormCriticalHours] = useState(24);
  const [formSubscriptionListId, setFormSubscriptionListId] = useState("");
  const [subEventType, setSubEventType] = useState<string>(SUBSCRIPTION_EVENT_TYPES[0]);
  const [subSafeId, setSubSafeId] = useState("");
  const [subSubscriptionListId, setSubSubscriptionListId] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");
  const [subError, setSubError] = useState("");
  const [safes, setSafes] = useState<SafeOption[]>([]);
  const [subscriptionLists, setSubscriptionLists] = useState<SubscriptionListWithCount[]>([]);

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

  const fetchLists = useCallback(async () => {
    const res = await fetch("/api/alerts/subscription-lists");
    if (!res.ok) return;
    const data = await res.json();
    setSubscriptionLists(data.lists ?? []);
  }, []);

  useEffect(() => {
    if (open) {
      setError("");
      setSubError("");
      fetchSafes();
      fetchLists();
    }
  }, [open, fetchSafes, fetchLists]);

  const networkName = (slug: string) => SAFE_CHAINS.find((c) => c.slug === slug)?.name ?? slug;

  const handleSubmitCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitLoading(true);
    try {
      const config =
        formType === "pending_tx"
          ? { minCount: formMinCount }
          : formType === "queue_stuck"
            ? { days: formDays }
            : formType === "config_change_critical"
              ? { hours: formCriticalHours }
              : formType === "signer_eoa_activity"
                ? { lookbackDays: 7, minOutgoingCount: 1 }
                : formType === "verification_expiring"
                  ? { daysBeforeExpiry: 30 }
                  : formType === "pending_tx_unreviewed"
                    ? { hours: 24 }
                    : {};
      const res = await fetch("/api/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formType,
          safeId: formSafeId || null,
          subscriptionListId: formSubscriptionListId || null,
          name: formName.trim() || undefined,
          config,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to create rule");
        return;
      }
      onSuccess();
      onClose();
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSubmitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubError("");
    setSubmitLoading(true);
    try {
      const res = await fetch("/api/alerts/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: subEventType,
          safeId: subSafeId || null,
          subscriptionListId: subSubscriptionListId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubError(data.error ?? "Failed to create trigger");
        return;
      }
      onSuccess();
      onClose();
    } finally {
      setSubmitLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-trigger-title"
        className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                <Bell className="h-6 w-6" aria-hidden />
              </div>
              <h2 id="create-trigger-title" className="text-xl font-bold tracking-tight text-foreground">
                Create trigger
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <p className="ml-14 text-sm text-muted-foreground">Configure a new alert rule for your safes.</p>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto max-h-[60vh] shrink-0">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Trigger type
            </label>
            <div className="flex gap-10">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="triggerType"
                  checked={kind === "condition"}
                  onChange={() => setKind("condition")}
                  className="w-5 h-5 text-primary border-border bg-background focus:ring-primary focus:ring-2 focus:ring-offset-2 focus:ring-offset-card rounded-full"
                />
                <span className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  Condition / rule
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="triggerType"
                  checked={kind === "event"}
                  onChange={() => setKind("event")}
                  className="w-5 h-5 text-primary border-border bg-background focus:ring-primary focus:ring-2 focus:ring-offset-2 focus:ring-offset-card rounded-full"
                />
                <span className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  Multisig event
                </span>
              </label>
            </div>
          </div>

          {kind === "condition" ? (
            <form id="create-trigger-condition-form" onSubmit={handleSubmitCondition} className="space-y-6">
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <div className="grid grid-cols-2 gap-x-10 gap-y-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Condition
                  </label>
                  <select
                    value={formType}
                    onChange={(e) =>
                      setFormType(
                        e.target.value as typeof formType
                      )
                    }
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  >
                    <option value="pending_tx">Pending tx count ≥ N</option>
                    <option value="queue_stuck">Queue stuck ≥ N days</option>
                    <option value="signer_change">Signer list changed</option>
                    <option value="threshold_decreased">Threshold decreased</option>
                    <option value="signer_count_decreased">Signer count decreased</option>
                    <option value="config_change_critical">Critical config change (24h)</option>
                    <option value="unverified_signers">Unverified signers (treasury+)</option>
                    <option value="missing_external_signer">Missing external signer</option>
                    <option value="signer_eoa_activity">Signer EOA activity (7d)</option>
                    <option value="verification_expiring">Verification expiring</option>
                    <option value="pending_tx_unreviewed">Pending tx unreviewed (treasury+)</option>
                    <option value="oob_verification_overdue">OOB verification overdue</option>
                    <option value="oob_verification_required">OOB verification required</option>
                    <option value="security_incident_reported">Security incident reported (24h)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Scope
                  </label>
                  <select
                    value={formSafeId}
                    onChange={(e) => setFormSafeId(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  >
                    <option value="">All safes</option>
                    {safes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name || truncateAddress(s.address)} · {networkName(s.network)}
                      </option>
                    ))}
                  </select>
                </div>
                {formType === "pending_tx" && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Notify when pending count is at least
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formMinCount}
                      onChange={(e) => setFormMinCount(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-background border border-border rounded-xl py-3 px-4 text-sm text-foreground tabular-nums focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                    />
                  </div>
                )}
                {formType === "config_change_critical" && (
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Lookback hours</label>
                    <input
                      type="number"
                      min={1}
                      value={formCriticalHours}
                      onChange={(e) => setFormCriticalHours(parseInt(e.target.value, 10) || 24)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                )}
                {formType === "queue_stuck" && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Notify when oldest pending is older than (days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={formDays}
                      onChange={(e) => setFormDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full bg-background border border-border rounded-xl py-3 px-4 text-sm text-foreground tabular-nums focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Notify these people
                  </label>
                  <select
                    value={formSubscriptionListId}
                    onChange={(e) => setFormSubscriptionListId(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  >
                    <option value="">No notification (in-app only)</option>
                    {subscriptionLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name} ({list.memberCount} {list.memberCount === 1 ? "email" : "emails"})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground italic mt-2 leading-relaxed">
                    When this trigger first fires for a Safe, everyone in the list gets one email.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Label (optional)
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Treasury pending"
                  className="w-full bg-background border border-border rounded-xl py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
              </div>
            </form>
          ) : (
            <form id="create-trigger-event-form" onSubmit={handleSubmitEvent} className="space-y-6">
              {subError && <p className="text-sm text-destructive" role="alert">{subError}</p>}
              <div className="grid grid-cols-2 gap-x-10 gap-y-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Event type
                  </label>
                  <select
                    value={subEventType}
                    onChange={(e) => setSubEventType(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  >
                    {SUBSCRIPTION_EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>{eventTypeLabel(t)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Scope
                  </label>
                  <select
                    value={subSafeId}
                    onChange={(e) => setSubSafeId(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  >
                    <option value="">All safes</option>
                    {safes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name || truncateAddress(s.address)} · {networkName(s.network)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Notify these people
                  </label>
                  <select
                    value={subSubscriptionListId}
                    onChange={(e) => setSubSubscriptionListId(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  >
                    <option value="">No notification (in-app only)</option>
                    {subscriptionLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name} ({list.memberCount} {list.memberCount === 1 ? "email" : "emails"})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground italic mt-2 leading-relaxed">
                    When this event occurs, everyone in the list receives an email.
                  </p>
                </div>
              </div>
            </form>
          )}
        </div>

        <div className="p-6 bg-muted/20 border-t border-border flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors px-4 py-2 uppercase tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (kind === "condition") {
                const form = document.getElementById("create-trigger-condition-form");
                if (form instanceof HTMLFormElement) form.requestSubmit();
              } else {
                const form = document.getElementById("create-trigger-event-form");
                if (form instanceof HTMLFormElement) form.requestSubmit();
              }
            }}
            disabled={submitLoading}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3.5 rounded-xl text-sm font-bold uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg min-h-[44px] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
          >
            {submitLoading ? <Loader2 className="h-5 w-5 animate-spin shrink-0" aria-hidden /> : <PlusCircle className="h-5 w-5 shrink-0" aria-hidden />}
            Create trigger
          </button>
        </div>
      </div>
    </div>
  );
}
