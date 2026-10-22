import { pgTable, text, integer, timestamp, json, uuid, boolean } from "drizzle-orm/pg-core";
import { orgs } from "./orgs.schema";
import { safes } from "./safes.schema";
import { users } from "./users.schema";
import { subscriptionLists } from "./subscription-lists.schema";

/**
 * Alert rules (per-org)
 * - safeId: optional - if set, rule applies to that safe only; null = all safes in org
 * - subscriptionListId: optional - when rule first fires, send email to all members of this list
 * - type: pending_tx | balance_change_pct | balance_change_abs | signer_change | queue_stuck
 * - config: JSON with type-specific configuration
 */
export const alertRules = pgTable("alert_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  safeId: uuid("safe_id").references(() => safes.id, { onDelete: "cascade" }),
  subscriptionListId: uuid("subscription_list_id").references(() => subscriptionLists.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  config: json("config").notNull(),
  name: text("name"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Per-rule, per-safe fire state to detect first-fire transition (NOT FIRING → FIRING).
 * Email is sent only on that transition when rule has a subscription list.
 */
export const ruleFireState = pgTable(
  "rule_fire_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => alertRules.id, { onDelete: "cascade" }),
    safeId: uuid("safe_id")
      .notNull()
      .references(() => safes.id, { onDelete: "cascade" }),
    isFiring: boolean("is_firing").notNull(),
    lastFiredAt: timestamp("last_fired_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [{ unique: [t.ruleId, t.safeId] }]
);

/**
 * Last-known state per safe for alert evaluation
 * Used for balance/signer change detection
 */
export const alertSafeState = pgTable("alert_safe_state", {
  safeId: uuid("safe_id")
    .primaryKey()
    .references(() => safes.id, { onDelete: "cascade" }),
  lastBalancesJson: json("last_balances_json"),
  lastOwnersJson: json("last_owners_json"),
  lastThreshold: integer("last_threshold"),
  lastPendingOldestAt: timestamp("last_pending_oldest_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- Proposal-time alerting (Level 1) ---

/**
 * Raw pending transaction from Safe Transaction Service.
 * One row per safeTxHash (idempotent).
 */
export const rawTransactions = pgTable("raw_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  safeId: uuid("safe_id")
    .notNull()
    .references(() => safes.id, { onDelete: "cascade" }),
  safeTxHash: text("safe_tx_hash").notNull().unique(),
  toAddress: text("to_address").notNull(),
  value: text("value").notNull(),
  data: text("data"),
  operation: integer("operation").notNull(),
  proposedBy: text("proposed_by").notNull(),
  nonce: integer("nonce").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Normalized event from classifier (one per tx + eventType).
 * Unique on (safeTxHash, eventType) for idempotency.
 */
export const normalizedEvents = pgTable(
  "normalized_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    safeId: uuid("safe_id")
      .notNull()
      .references(() => safes.id, { onDelete: "cascade" }),
    safeTxHash: text("safe_tx_hash").notNull(),
    eventType: text("event_type").notNull(),
    category: text("category").notNull(),
    metadata: json("metadata").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [{ unique: [t.safeTxHash, t.eventType] }]
);

/**
 * Alert subscription: who receives which event types.
 * When subscription_list_id is set, email is sent to all list members (same as rule first-fire).
 * Legacy: channel/channelConfig still used when subscription_list_id is null (single email or Slack webhook).
 */
export const alertSubscriptions = pgTable("alert_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  safeId: uuid("safe_id").references(() => safes.id, { onDelete: "cascade" }),
  subscriptionListId: uuid("subscription_list_id").references(() => subscriptionLists.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  channel: text("channel").notNull(), // "email" | "slack" (legacy when subscription_list_id null)
  channelConfig: json("channel_config").notNull(), // legacy: { email } or { webhookUrl }; empty {} when using list
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Alert delivery log for idempotency (no duplicate sends per subscription per event).
 */
export const alertDeliveries = pgTable(
  "alert_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    normalizedEventId: uuid("normalized_event_id")
      .notNull()
      .references(() => normalizedEvents.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => alertSubscriptions.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    status: text("status").notNull(), // "sent" | "failed"
    response: text("response"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [{ unique: [t.normalizedEventId, t.subscriptionId] }]
);
