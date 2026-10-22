import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { orgs } from "./orgs.schema";

/**
 * Named email subscription lists for alert-rule first-fire notifications.
 */
export const subscriptionLists = pgTable("subscription_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Email members of a subscription list. Unique per (list, email).
 */
export const subscriptionListMembers = pgTable(
  "subscription_list_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriptionListId: uuid("subscription_list_id")
      .notNull()
      .references(() => subscriptionLists.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [{ unique: [t.subscriptionListId, t.email] }]
);
