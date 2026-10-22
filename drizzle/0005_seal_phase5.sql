-- SEAL Phase 5: Advanced governance & certification

CREATE TABLE IF NOT EXISTS "safe_delay_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "safe_id" uuid NOT NULL REFERENCES "safes"("id") ON DELETE CASCADE,
  "attachment_type" text NOT NULL,
  "module_address" text,
  "delay_seconds" integer,
  "metadata_json" json,
  "source" text DEFAULT 'snapshot' NOT NULL,
  "detected_at" timestamp DEFAULT now() NOT NULL,
  "last_verified_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "safe_delay_attachments_org_idx" ON "safe_delay_attachments" ("org_id");
CREATE INDEX IF NOT EXISTS "safe_delay_attachments_safe_idx" ON "safe_delay_attachments" ("safe_id");
CREATE UNIQUE INDEX IF NOT EXISTS "safe_delay_attachments_safe_module_idx" ON "safe_delay_attachments" ("safe_id", "module_address");

CREATE TABLE IF NOT EXISTS "org_governance_settings" (
  "org_id" uuid PRIMARY KEY REFERENCES "orgs"("id") ON DELETE CASCADE,
  "min_delay_seconds_treasury" integer DEFAULT 86400,
  "min_delay_seconds_protocol" integer DEFAULT 172800,
  "require_timelock_protocol_critical" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "safe_environment_pairs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "production_safe_id" uuid NOT NULL REFERENCES "safes"("id") ON DELETE CASCADE,
  "twin_safe_id" uuid NOT NULL REFERENCES "safes"("id") ON DELETE CASCADE,
  "twin_network" text NOT NULL,
  "purpose" text DEFAULT 'staging' NOT NULL,
  "linked_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "last_drill_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "safe_environment_pairs_prod_twin_idx" ON "safe_environment_pairs" ("production_safe_id", "twin_safe_id");
CREATE INDEX IF NOT EXISTS "safe_environment_pairs_org_idx" ON "safe_environment_pairs" ("org_id");

CREATE TABLE IF NOT EXISTS "safe_webhook_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "safe_id" uuid REFERENCES "safes"("id") ON DELETE CASCADE,
  "network" text NOT NULL,
  "safe_address" text NOT NULL,
  "webhook_secret" text NOT NULL,
  "event_types_json" json,
  "status" text DEFAULT 'active' NOT NULL,
  "last_received_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "safe_webhook_subscriptions_org_idx" ON "safe_webhook_subscriptions" ("org_id");
CREATE INDEX IF NOT EXISTS "safe_webhook_subscriptions_safe_idx" ON "safe_webhook_subscriptions" ("safe_id");

CREATE TABLE IF NOT EXISTS "webhook_event_inbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "subscription_id" uuid REFERENCES "safe_webhook_subscriptions"("id") ON DELETE SET NULL,
  "event_type" text NOT NULL,
  "payload_json" json,
  "safe_address" text,
  "safe_tx_hash" text,
  "processed_at" timestamp,
  "processing_error" text,
  "received_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "webhook_event_inbox_org_idx" ON "webhook_event_inbox" ("org_id");
CREATE INDEX IF NOT EXISTS "webhook_event_inbox_processed_idx" ON "webhook_event_inbox" ("processed_at");

CREATE TABLE IF NOT EXISTS "tx_simulation_cache" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "safe_id" uuid NOT NULL REFERENCES "safes"("id") ON DELETE CASCADE,
  "safe_tx_hash" text NOT NULL,
  "network" text NOT NULL,
  "block_number" integer,
  "provider" text DEFAULT 'tenderly' NOT NULL,
  "status" text NOT NULL,
  "result_json" json,
  "simulated_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS "tx_simulation_cache_safe_tx_block_idx" ON "tx_simulation_cache" ("safe_id", "safe_tx_hash", "block_number");
CREATE INDEX IF NOT EXISTS "tx_simulation_cache_org_idx" ON "tx_simulation_cache" ("org_id");

CREATE TABLE IF NOT EXISTS "certification_exports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "exported_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "manifest_json" json,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "certification_exports_org_idx" ON "certification_exports" ("org_id");
