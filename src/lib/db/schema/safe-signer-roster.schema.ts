import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
  json,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { orgs } from "./orgs.schema";
import { safes } from "./safes.schema";
import { users } from "./users.schema";

/** Per-Safe signer roster with metadata and verification state. */
export const safeSignerRoster = pgTable(
  "safe_signer_roster",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    safeId: uuid("safe_id")
      .notNull()
      .references(() => safes.id, { onDelete: "cascade" }),
    signerAddress: text("signer_address").notNull(),
    displayName: text("display_name"),
    /** internal | external_advisor | security_partner | unknown */
    signerType: text("signer_type").default("unknown").notNull(),
    roleLabel: text("role_label"),
    orgMemberUserId: uuid("org_member_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** ledger | trezor | gridplus | software | unknown */
    hardwareWallet: text("hardware_wallet"),
    isDedicatedSigner: boolean("is_dedicated_signer"),
    /** unverified | pending | verified | expired | revoked */
    verificationStatus: text("verification_status").default("unverified").notNull(),
    /** siwe_affiliation | admin_attested */
    verificationMethod: text("verification_method"),
    verifiedAt: timestamp("verified_at"),
    verifiedByUserId: uuid("verified_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    /** snapshot_sync | manual */
    source: text("source").default("snapshot_sync").notNull(),
    removedAt: timestamp("removed_at"),
    pendingAffiliationRequestId: text("pending_affiliation_request_id"),
    pendingAffiliationExpiresAt: timestamp("pending_affiliation_expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("safe_signer_roster_safe_signer_idx").on(table.safeId, table.signerAddress),
    index("safe_signer_roster_org_idx").on(table.orgId),
  ]
);

/** Immutable affiliation proof records. */
export const signerAffiliationProofs = pgTable(
  "signer_affiliation_proofs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rosterId: uuid("roster_id")
      .notNull()
      .references(() => safeSignerRoster.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    safeId: uuid("safe_id")
      .notNull()
      .references(() => safes.id, { onDelete: "cascade" }),
    signerAddress: text("signer_address").notNull(),
    messageText: text("message_text").notNull(),
    messageHash: text("message_hash").notNull(),
    signature: text("signature").notNull(),
    signedByUserId: uuid("signed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    verifiedAt: timestamp("verified_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("signer_affiliation_proofs_roster_idx").on(table.rosterId)]
);

/** Email invites for external signer verification. */
export const signerVerificationRequests = pgTable(
  "signer_verification_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rosterId: uuid("roster_id")
      .notNull()
      .references(() => safeSignerRoster.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    /** pending | completed | expired | revoked */
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("signer_verification_requests_token_idx").on(table.tokenHash)]
);

/** Cached EOA activity for roster addresses. */
export const signerEoaActivity = pgTable(
  "signer_eoa_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    signerAddress: text("signer_address").notNull(),
    network: text("network").notNull(),
    lastCheckedAt: timestamp("last_checked_at"),
    lastOutgoingTxAt: timestamp("last_outgoing_tx_at"),
    lastOutgoingTxHash: text("last_outgoing_tx_hash"),
    activityCount7d: integer("activity_count_7d").default(0),
    rawSummary: json("raw_summary"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("signer_eoa_activity_addr_network_idx").on(
      table.signerAddress,
      table.network
    ),
    index("signer_eoa_activity_org_idx").on(table.orgId),
  ]
);
