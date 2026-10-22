import { pgTable, text, timestamp, json, uuid } from "drizzle-orm/pg-core";
// resourceId is text (not uuid) for flexible external identifiers
import { orgs } from "./orgs.schema";
import { users } from "./users.schema";

/**
 * Organization audit logs
 * Tracks actions within an organization (Safe add/remove, team changes, etc.)
 */
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  metadata: json("metadata"),
  ip: text("ip"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

