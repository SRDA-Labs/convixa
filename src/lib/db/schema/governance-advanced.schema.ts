import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  json,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { orgs } from "./orgs.schema";
import { safes } from "./safes.schema";
import { users } from "./users.schema";

export const safeDelayAttachments = pgTable(
  "safe_delay_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    safeId: uuid("safe_id")
      .notNull()
      .references(() => safes.id, { onDelete: "cascade" }),
    attachmentType: text("attachment_type").notNull(),
    moduleAddress: text("module_address"),
    delaySeconds: integer("delay_seconds"),
    metadataJson: json("metadata_json").$type<Record<string, unknown>>(),
    source: text("source").default("snapshot").notNull(),
    detectedAt: timestamp("detected_at").defaultNow().notNull(),
    lastVerifiedAt: timestamp("last_verified_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("safe_delay_attachments_org_idx").on(table.orgId),
    index("safe_delay_attachments_safe_idx").on(table.safeId),
    uniqueIndex("safe_delay_attachments_safe_module_idx").on(
      table.safeId,
      table.moduleAddress
    ),
  ]
);

export const orgGovernanceSettings = pgTable("org_governance_settings", {
  orgId: uuid("org_id")
    .primaryKey()
    .references(() => orgs.id, { onDelete: "cascade" }),
  minDelaySecondsTreasury: integer("min_delay_seconds_treasury").default(86400),
  minDelaySecondsProtocol: integer("min_delay_seconds_protocol").default(172800),
  requireTimelockProtocolCritical: boolean("require_timelock_protocol_critical")
    .default(true)
    .notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const safeEnvironmentPairs = pgTable(
  "safe_environment_pairs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    productionSafeId: uuid("production_safe_id")
      .notNull()
      .references(() => safes.id, { onDelete: "cascade" }),
    twinSafeId: uuid("twin_safe_id")
      .notNull()
      .references(() => safes.id, { onDelete: "cascade" }),
    twinNetwork: text("twin_network").notNull(),
    purpose: text("purpose").default("staging").notNull(),
    linkedByUserId: uuid("linked_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    lastDrillAt: timestamp("last_drill_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("safe_environment_pairs_prod_twin_idx").on(
      table.productionSafeId,
      table.twinSafeId
    ),
    index("safe_environment_pairs_org_idx").on(table.orgId),
  ]
);

export const safeWebhookSubscriptions = pgTable(
  "safe_webhook_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    safeId: uuid("safe_id").references(() => safes.id, { onDelete: "cascade" }),
    network: text("network").notNull(),
    safeAddress: text("safe_address").notNull(),
    webhookSecret: text("webhook_secret").notNull(),
    eventTypesJson: json("event_types_json").$type<string[]>(),
    status: text("status").default("active").notNull(),
    lastReceivedAt: timestamp("last_received_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("safe_webhook_subscriptions_org_idx").on(table.orgId),
    index("safe_webhook_subscriptions_safe_idx").on(table.safeId),
  ]
);

export const webhookEventInbox = pgTable(
  "webhook_event_inbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(
      () => safeWebhookSubscriptions.id,
      { onDelete: "set null" }
    ),
    eventType: text("event_type").notNull(),
    payloadJson: json("payload_json").$type<Record<string, unknown>>(),
    safeAddress: text("safe_address"),
    safeTxHash: text("safe_tx_hash"),
    processedAt: timestamp("processed_at"),
    processingError: text("processing_error"),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
  },
  (table) => [
    index("webhook_event_inbox_org_idx").on(table.orgId),
    index("webhook_event_inbox_processed_idx").on(table.processedAt),
  ]
);

export const txSimulationCache = pgTable(
  "tx_simulation_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    safeId: uuid("safe_id")
      .notNull()
      .references(() => safes.id, { onDelete: "cascade" }),
    safeTxHash: text("safe_tx_hash").notNull(),
    network: text("network").notNull(),
    blockNumber: integer("block_number"),
    provider: text("provider").default("tenderly").notNull(),
    status: text("status").notNull(),
    resultJson: json("result_json").$type<Record<string, unknown>>(),
    simulatedAt: timestamp("simulated_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
  },
  (table) => [
    uniqueIndex("tx_simulation_cache_safe_tx_block_idx").on(
      table.safeId,
      table.safeTxHash,
      table.blockNumber
    ),
    index("tx_simulation_cache_org_idx").on(table.orgId),
  ]
);

export const certificationExports = pgTable(
  "certification_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    exportedByUserId: uuid("exported_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    manifestJson: json("manifest_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("certification_exports_org_idx").on(table.orgId)]
);
