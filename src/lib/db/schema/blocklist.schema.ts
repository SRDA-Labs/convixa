import { pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { orgs } from "./orgs.schema";
import { users } from "./users.schema";

/**
 * Per-org blacklisted addresses.
 */
export const orgBlacklistedAddresses = pgTable(
  "org_blacklisted_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    address: text("address").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [uniqueIndex("org_blacklisted_addresses_org_id_address_key").on(table.orgId, table.address)]
);
