"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { POLICY_TEMPLATES } from "@/lib/policy-engine/templates";
import { isPolicyConfig } from "@/lib/policy-engine/config";
import type { PolicyConfig } from "@/lib/policy-engine/config";

type PolicyDetail = {
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
};

function policyTypeLabel(type: string): string {
  const t = POLICY_TEMPLATES.find((x) => x.id === type);
  return t ? t.name : type;
}

export function PolicyDetailClient() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [policy, setPolicy] = useState<PolicyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [editSubscriptionListId, setEditSubscriptionListId] = useState("");
  const [editConfig, setEditConfig] = useState<PolicyConfig | null>(null); // cloned config when new-format
  const [editAmountUsd, setEditAmountUsd] = useState("");
  const [subscriptionLists, setSubscriptionLists] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchPolicy = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/org/policies/${id}`);
      if (!res.ok) {
        if (res.status === 404) setPolicy(null);
        return;
      }
      const data = await res.json();
      const p = data.policy ?? null;
      setPolicy(p);
      if (p) {
        setEditName(p.name);
        setEditEnabled(p.enabled);
        setEditSubscriptionListId(p.subscriptionListId ?? "");
        const cfg = p.config as unknown;
        if (isPolicyConfig(cfg)) {
          setEditConfig(JSON.parse(JSON.stringify(cfg)));
          const firstAmount = cfg.conditions.find((c) => "value" in c && typeof (c as { value: number }).value === "number");
          if (firstAmount && "value" in firstAmount)
            setEditAmountUsd(String((firstAmount as { value: number }).value));
        } else {
          setEditConfig(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  useEffect(() => {
    fetch("/api/alerts/subscription-lists")
      .then((r) => r.json())
      .then((d) => setSubscriptionLists(d.lists ?? []))
      .catch(() => setSubscriptionLists([]));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!policy) return;
    setError(null);
    setSaving(true);
    try {
      const body: {
        name: string;
        enabled: boolean;
        subscriptionListId: string | null;
        config?: PolicyConfig;
      } = {
        name: editName.trim(),
        enabled: editEnabled,
        subscriptionListId: editSubscriptionListId || null,
      };
      if (editConfig) {
        if (editAmountUsd.trim()) {
          const value = parseFloat(editAmountUsd);
          if (Number.isFinite(value) && value >= 0) {
            for (const c of editConfig.conditions) {
              if ("value" in c) (c as { value: number }).value = value;
            }
          }
        }
        for (const a of editConfig.actions) {
          if (a.type === "alert") a.subscriptionListId = editSubscriptionListId || null;
        }
        body.config = editConfig;
      }
      const res = await fetch(`/api/org/policies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update");
        return;
      }
      await fetchPolicy();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading…
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/controls/policies" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Policies
        </Link>
        <p className="text-sm text-muted-foreground">Policy not found.</p>
      </div>
    );
  }

  const hasNewConfig = isPolicyConfig(policy.config);
  const firstAmountCondition = hasNewConfig && editConfig
    ? editConfig.conditions.find((c) => "value" in c && typeof (c as { value: number }).value === "number")
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/controls/policies" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-4 w-4" /> Back to Policies
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{policy.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {policyTypeLabel(policy.type)} · {policy.scope === "org" ? "Org-wide" : "Single Safe"}
        </p>
        {!hasNewConfig && (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
            Invalid or unsupported config — not evaluated. Recreate from a template to use the policy engine.
          </p>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-4 max-w-md">
        <div>
          <label htmlFor="edit-name" className="block text-sm font-medium text-foreground">Name</label>
          <input
            id="edit-name"
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className={cn(
              "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            )}
            required
          />
        </div>
        <div>
          <label htmlFor="edit-enabled" className="block text-sm font-medium text-foreground">Enabled</label>
          <select
            id="edit-enabled"
            value={editEnabled ? "true" : "false"}
            onChange={(e) => setEditEnabled(e.target.value === "true")}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        <div>
          <label htmlFor="edit-subscription" className="block text-sm font-medium text-foreground">Notify (subscription list)</label>
          <select
            id="edit-subscription"
            value={editSubscriptionListId}
            onChange={(e) => setEditSubscriptionListId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            <option value="">None</option>
            {subscriptionLists.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        {hasNewConfig && firstAmountCondition && (
          <div>
            <label htmlFor="edit-amount-usd" className="block text-sm font-medium text-foreground">Threshold (USD)</label>
            <input
              id="edit-amount-usd"
              type="number"
              min={0}
              step={0.01}
              value={editAmountUsd}
              onChange={(e) => setEditAmountUsd(e.target.value)}
              placeholder="e.g. 10000"
              className={cn(
                "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              )}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Pending native transfer value (at current rate) above this triggers the policy.
            </p>
          </div>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className={cn(
            "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          )}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>

      {hasNewConfig && editConfig && (
        <div>
          <h2 className="text-sm font-medium text-foreground mb-2">Config (trigger, conditions, actions)</h2>
          <pre className="rounded-lg border border-border bg-muted/30 p-4 text-xs font-mono text-foreground overflow-x-auto">
            {JSON.stringify(editConfig, null, 2)}
          </pre>
        </div>
      )}
      {!hasNewConfig && (
        <div>
          <h2 className="text-sm font-medium text-foreground mb-2">Config (raw)</h2>
          <pre className="rounded-lg border border-border bg-muted/30 p-4 text-xs font-mono text-foreground overflow-x-auto">
            {JSON.stringify(policy.config, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
