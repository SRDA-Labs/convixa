export type Trigger = "pending_tx" | "approval" | "config_change" | "balance_change";

export type ConditionConfig =
  | { type: "amount_usd_greater_than"; value: number }
  | { type: "per_period_spend_usd"; period: "day" | "week" | "month"; limit: number }
  | { type: "counterparty_in_list"; listId: string; mode: "allow" | "deny" }
  | { type: "counterparty_not_in_list"; listId: string }
  | { type: "safe_tag_in"; tags: string[] }
  | { type: "new_counterparty"; lookbackDays: number }
  | { type: "approval_amount_usd_greater_than"; value: number }
  | { type: "to_exchange"; listId: string }
  | { type: "time_of_day"; window: { start: string; end: string; timezone: string } }
  | { type: "balance_change_pct"; threshold: number; lookbackMinutes: number }
  | { type: "event_type_in"; eventTypes: string[] };

export type ActionConfig =
  | { type: "alert"; severity: "info" | "warning" | "critical"; subscriptionListId: string | null }
  | { type: "block"; reasonTemplate?: string };

export type PolicyConfig = {
  trigger: Trigger;
  conditions: ConditionConfig[];
  actions: ActionConfig[];
};

/** Type guard: config is the unified trigger/conditions/actions shape. */
export function isPolicyConfig(config: unknown): config is PolicyConfig {
  const c = config as Record<string, unknown> | null;
  return (
    c != null &&
    typeof c === "object" &&
    typeof c.trigger === "string" &&
    Array.isArray(c.conditions) &&
    Array.isArray(c.actions)
  );
}

