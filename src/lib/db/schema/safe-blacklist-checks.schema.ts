import { pgTable, text, timestamp, uuid, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { safes } from "./safes.schema";
import { orgs } from "./orgs.schema";

/**
 * Cached result of "has this Safe ever sent a tx to a blacklisted address?".
 */
export const safeBlacklistChecks = pgTable(
  "safe_blacklist_checks",
  {
    safeId: uuid("safe_id")
      .notNull()
      .references(() => safes.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    checkedAt: timestamp("checked_at").notNull(),
    hasInteraction: boolean("has_interaction").notNull(),
    reason: text("reason"),
  },
  (table) => [uniqueIndex("safe_blacklist_checks_safe_id_org_id_key").on(table.safeId, table.orgId)]
);
