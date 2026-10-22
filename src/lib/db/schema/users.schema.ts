import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  uuid,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";

/**
 * Users (authentication users)
 * - twoFactorEnabled: whether 2FA is enabled for this user
 * - linkedWalletAddress: EOA verified via EIP-4361 (SIWE) message signing
 * - pendingWalletNonce / pendingWalletNonceExpiresAt: for SIWE link flow
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  sessionsRevokedAt: timestamp("sessions_revoked_at"),
  linkedWalletAddress: text("linked_wallet_address"),
  pendingWalletNonce: text("pending_wallet_nonce"),
  pendingWalletNonceExpiresAt: timestamp("pending_wallet_nonce_expires_at"),
  timezone: text("timezone").default("UTC"),
  preferences: jsonb("preferences").$type<{
    theme?: "light" | "dark" | "system";
    currency?: string;
    dateFormat?: string;
    compactMode?: boolean;
  }>().default({
    theme: "dark",
    currency: "USD",
    dateFormat: "MM/DD/YYYY",
    compactMode: false,
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * OTP codes for 2FA
 * - purpose: 'enable_2fa' | 'login' | 'login_token'
 */
export const otpCodes = pgTable("otp_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  purpose: text("purpose").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * NextAuth compatibility tables
 * (not actively used with credentials-only auth)
 */
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [uniqueIndex("accounts_provider_provider_account_id_key").on(table.provider, table.providerAccountId)]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires").notNull(),
});
