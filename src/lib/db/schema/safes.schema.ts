import { pgTable, text, integer, timestamp, json, uuid } from "drizzle-orm/pg-core";
import { orgs } from "./orgs.schema";
import { teams } from "./teams.schema";

/**
 * Safes (inventory)
 */
export const safes = pgTable("safes", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  address: text("address").notNull(),
  network: text("network").notNull(),
  name: text("name"),
  tags: json("tags"),
  notes: text("notes"),
  /** SEAL profile: personal | operational | treasury | protocol_critical */
  classification: text("classification"),
  purpose: text("purpose"),
  /** Justification when non-standard Safe modules are enabled */
  moduleExceptionNote: text("module_exception_note"),
  implementation: text("implementation").default("safe").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Cached Safe API data
 */
export const safeSnapshots = pgTable("safe_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  safeId: uuid("safe_id")
    .notNull()
    .references(() => safes.id, { onDelete: "cascade" }),
  threshold: integer("threshold"),
  owners: json("owners"),
  nonce: integer("nonce"),
  balances: json("balances"),
  pendingCount: integer("pending_count").default(0),
  lastTxAt: timestamp("last_tx_at"),
  implementationVersion: text("implementation_version"),
  guardAddress: text("guard_address"),
  fallbackHandler: text("fallback_handler"),
  modulesJson: json("modules_json"),
  lastOwnersCount: integer("last_owners_count"),
  rawResponse: json("raw_response"),
  refreshedAt: timestamp("refreshed_at").notNull(),
});
