import { pgTable, text, timestamp, uuid, json, boolean } from "drizzle-orm/pg-core";
import { orgs } from "./orgs.schema";
import { users } from "./users.schema";
import { safes } from "./safes.schema";
import { subscriptionLists } from "./subscription-lists.schema";

export const POLICY_SCOPES = ["org", "safe"] as const;
export type PolicyScope = (typeof POLICY_SCOPES)[number];

export const POLICY_TYPES = [
  "large_tx_usd",
  "cold_wallet_activity",
  "malicious_list",
  "approval_amount_threshold",
  "multisig_activity",
  "allowlist",
  "to_exchange",
  "new_counterparty",
  "per_period_spend",
  "time_of_day",
  "new_counterparty_large_tx",
  "exchange_tx_monitor",
  "config_change_alert",
  "custom",
] as const;
export type PolicyType = (typeof POLICY_TYPES)[number];

export const policies = pgTable("policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  scope: text("scope").notNull(),
  safeId: uuid("safe_id").references(() => safes.id, { onDelete: "cascade" }),
  config: json("config").notNull(),
  subscriptionListId: uuid("subscription_list_id").references(() => subscriptionLists.id, { onDelete: "set null" }),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
});

export const policyFireState = pgTable(
  "policy_fire_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => policies.id, { onDelete: "cascade" }),
    safeId: uuid("safe_id")
      .notNull()
      .references(() => safes.id, { onDelete: "cascade" }),
    isFiring: boolean("is_firing").notNull(),
    lastFiredAt: timestamp("last_fired_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [{ unique: [t.policyId, t.safeId] }]
);
