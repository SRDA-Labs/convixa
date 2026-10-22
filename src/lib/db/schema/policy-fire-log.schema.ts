import { pgTable, text, timestamp, uuid, json, boolean } from "drizzle-orm/pg-core";
import { policies } from "./policies.schema";
import { orgs } from "./orgs.schema";
import { safes } from "./safes.schema";

/**
 * Audit trail of every policy fire event.
 * One row per (policy, safe, tx) combination when a policy evaluates to alert or block.
 */
export const policyFireLogs = pgTable(
  "policy_fire_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => policies.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    safeId: uuid("safe_id")
      .notNull()
      .references(() => safes.id, { onDelete: "cascade" }),
    safeTxHash: text("safe_tx_hash"),
    triggerType: text("trigger_type").notNull(), // pending_tx | config_change | balance_change
    actionType: text("action_type").notNull(),   // alert | block
    actionDetails: json("action_details").$type<{
      severity?: string;
      reason?: string;
      to?: string;
      value?: string;
    }>().default({}),
    notificationSent: boolean("notification_sent").default(false).notNull(),
    notificationSentAt: timestamp("notification_sent_at"),
    firedAt: timestamp("fired_at").defaultNow().notNull(),
  },
  (t) => [
    // Prevent duplicate fire logs for the same policy+tx combination within a window
    { unique: [t.policyId, t.safeId, t.safeTxHash] },
  ]
);
