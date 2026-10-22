import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { safes } from "./safes.schema";

/**
 * Tracks all executed transactions for every Safe.
 * Powers `new_counterparty` detection and `per_period_spend_usd` tracking
 * in the policy engine.
 */
export const safeTransactionHistory = pgTable("safe_transaction_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  safeId: uuid("safe_id")
    .notNull()
    .references(() => safes.id, { onDelete: "cascade" }),
  safeTxHash: text("safe_tx_hash").notNull(),
  nonce: integer("nonce").notNull(),
  toAddress: text("to_address").notNull(),
  valueWei: text("value_wei").notNull(),
  data: text("data"),
  operation: integer("operation").default(0),
  executedAt: timestamp("executed_at").notNull(),
  executionTxHash: text("execution_tx_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueTx: { unique: [table.safeId, table.safeTxHash] },
}));
