import { pgTable, text, timestamp, boolean, uuid, integer, jsonb, index } from "drizzle-orm/pg-core";
import { users } from "./users.schema";
import { safes } from "./safes.schema";
import { orgs } from "./orgs.schema";

/**
 * Signer Wallet Links — multiple wallet addresses per user.
 *
 * Users can link multiple EOAs (e.g. Ledger, Metamask, work keys).
 * Each link requires SIWE verification. One can be primary.
 *
 * This is additive to users.linked_wallet_address (single legacy field).
 */
export const signerWalletLinks = pgTable(
  "signer_wallet_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    walletAddress: text("wallet_address").notNull(),
    verifiedAt: timestamp("verified_at"),
    verificationMethod: text("verification_method").default("siwe"),
    isPrimary: boolean("is_primary").default(false),
    label: text("label"), // "Ledger", "Metamask", "Work key"
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_signer_wallet_user").on(table.userId),
    index("idx_signer_wallet_address").on(table.walletAddress),
  ]
);

/**
 * Signer Queue Cache — cached pending tx counts per signer per Safe.
 *
 * Updated by the alert poller every ~15s. Avoids expensive
 * cross-chain Safe API queries on every dashboard load.
 */
export const signerQueueCache = pgTable(
  "signer_queue_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletAddress: text("wallet_address").notNull(),
    safeId: uuid("safe_id")
      .notNull()
      .references(() => safes.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    pendingCount: integer("pending_count").default(0),
    pendingTxHashes: jsonb("pending_tx_hashes").$type<string[]>().default([]),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_queue_cache_address").on(table.walletAddress)]
);
