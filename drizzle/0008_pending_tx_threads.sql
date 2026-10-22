-- Team-scoped discussion records for queued multisig transactions

CREATE TABLE IF NOT EXISTS "pending_tx_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "safe_id" uuid NOT NULL REFERENCES "safes"("id") ON DELETE CASCADE,
  "safe_tx_hash" text NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "tx_snapshot" jsonb,
  "comment_count" integer DEFAULT 0 NOT NULL,
  "last_activity_at" timestamp,
  "opened_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "executed_at" timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS "pending_tx_threads_safe_tx_key"
  ON "pending_tx_threads" ("safe_id", "safe_tx_hash");
CREATE INDEX IF NOT EXISTS "pending_tx_threads_org_idx" ON "pending_tx_threads" ("org_id");
CREATE INDEX IF NOT EXISTS "pending_tx_threads_org_status_activity_idx"
  ON "pending_tx_threads" ("org_id", "status", "last_activity_at");

CREATE TABLE IF NOT EXISTS "pending_tx_thread_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL REFERENCES "pending_tx_threads"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "pending_tx_thread_comments_thread_idx"
  ON "pending_tx_thread_comments" ("thread_id");

CREATE TABLE IF NOT EXISTS "pending_tx_thread_activity" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL REFERENCES "pending_tx_threads"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "action" text NOT NULL,
  "summary" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "pending_tx_thread_activity_thread_created_idx"
  ON "pending_tx_thread_activity" ("thread_id", "created_at");

CREATE TABLE IF NOT EXISTS "pending_tx_thread_participants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL REFERENCES "pending_tx_threads"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" text DEFAULT 'collaborator' NOT NULL,
  "invited_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "pending_tx_thread_participants_thread_user_key"
  ON "pending_tx_thread_participants" ("thread_id", "user_id");
CREATE INDEX IF NOT EXISTS "pending_tx_thread_participants_thread_idx"
  ON "pending_tx_thread_participants" ("thread_id");
