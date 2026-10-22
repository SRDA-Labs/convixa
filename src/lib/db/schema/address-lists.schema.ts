import { pgTable, text, timestamp, uuid, uniqueIndex, json } from "drizzle-orm/pg-core";
import { orgs } from "./orgs.schema";
import { users } from "./users.schema";

export const ADDRESS_LIST_TYPES = ["vendors", "sponsors", "token_contracts", "watchlist"] as const;
export type AddressListType = (typeof ADDRESS_LIST_TYPES)[number];

export const addressLists = pgTable("address_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
});

export const addressListEntries = pgTable(
  "address_list_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => addressLists.id, { onDelete: "cascade" }),
    address: text("address").notNull(),
    label: text("label"),
    notes: text("notes"),
    tags: json("tags").$type<string[] | null>(),
    metadata: json("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("address_list_entries_list_id_address_key").on(table.listId, table.address)]
);
