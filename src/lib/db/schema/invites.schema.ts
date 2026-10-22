import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { orgs } from "./orgs.schema";
import { teams } from "./teams.schema";
import { users } from "./users.schema";

/**
 * Invites (email-based team/org invitations)
 * - status: 'pending' | 'accepted' | 'expired'
 * - token: unique token for accept link
 */
export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  token: text("token").notNull().unique(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
