import { pgTable, text, timestamp, json, uuid } from "drizzle-orm/pg-core";
import { orgs } from "./orgs.schema";
import { safes } from "./safes.schema";

export const SAFE_CONFIG_EVENT_TYPES = [
  "SIGNER_ADDED",
  "SIGNER_REMOVED",
  "SIGNER_SWAPPED",
  "THRESHOLD_CHANGED",
  "THRESHOLD_DECREASED",
  "SIGNER_COUNT_DECREASED",
  "GUARD_SET",
  "FALLBACK_HANDLER_SET",
  "MODULE_ENABLED",
  "MODULE_DISABLED",
  "OWNERS_REFRESH_DIFF",
] as const;

export type SafeConfigEventType = (typeof SAFE_CONFIG_EVENT_TYPES)[number];

export const SAFE_CONFIG_EVENT_SOURCES = [
  "executed_tx",
  "pending_proposed",
  "snapshot_diff",
] as const;

export type SafeConfigEventSource = (typeof SAFE_CONFIG_EVENT_SOURCES)[number];

/**
 * Immutable audit of Safe configuration changes (executed, proposed, or detected on refresh).
 */
export const safeConfigEvents = pgTable("safe_config_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  safeId: uuid("safe_id")
    .notNull()
    .references(() => safes.id, { onDelete: "cascade" }),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  source: text("source").notNull(),
  safeTxHash: text("safe_tx_hash"),
  beforeJson: json("before_json"),
  afterJson: json("after_json"),
  severity: text("severity").notNull().default("info"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
