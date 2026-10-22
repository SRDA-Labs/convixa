CREATE TABLE IF NOT EXISTS "checklist_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"classification" text,
	"tx_categories" json,
	"items_json" json,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_templates_org_idx" ON "checklist_templates" ("org_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pending_tx_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"safe_id" uuid NOT NULL,
	"safe_tx_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_address" text,
	"template_id" uuid,
	"items_state_json" json,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"signing_note" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pending_tx_reviews_safe_tx_user_idx" ON "pending_tx_reviews" ("safe_id","safe_tx_hash","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pending_tx_reviews_org_idx" ON "pending_tx_reviews" ("org_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_tx_reviews" ADD CONSTRAINT "pending_tx_reviews_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_tx_reviews" ADD CONSTRAINT "pending_tx_reviews_safe_id_safes_id_fk" FOREIGN KEY ("safe_id") REFERENCES "public"."safes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_tx_reviews" ADD CONSTRAINT "pending_tx_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_tx_reviews" ADD CONSTRAINT "pending_tx_reviews_template_id_checklist_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oob_verification_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"safe_id" uuid NOT NULL,
	"safe_tx_hash" text,
	"config_event_id" uuid,
	"normalized_event_id" uuid,
	"case_type" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"required_channels" json,
	"due_at" timestamp,
	"opened_by_user_id" uuid NOT NULL,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oob_cases_org_idx" ON "oob_verification_cases" ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oob_cases_safe_idx" ON "oob_verification_cases" ("safe_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oob_cases_status_idx" ON "oob_verification_cases" ("status");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oob_verification_cases" ADD CONSTRAINT "oob_verification_cases_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oob_verification_cases" ADD CONSTRAINT "oob_verification_cases_safe_id_safes_id_fk" FOREIGN KEY ("safe_id") REFERENCES "public"."safes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oob_verification_cases" ADD CONSTRAINT "oob_verification_cases_config_event_id_safe_config_events_id_fk" FOREIGN KEY ("config_event_id") REFERENCES "public"."safe_config_events"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oob_verification_cases" ADD CONSTRAINT "oob_verification_cases_opened_by_user_id_users_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oob_verification_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"submitted_by_user_id" uuid NOT NULL,
	"evidence_type" text NOT NULL,
	"evidence_value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oob_evidence_case_idx" ON "oob_verification_evidence" ("case_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oob_verification_evidence" ADD CONSTRAINT "oob_verification_evidence_case_id_oob_verification_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."oob_verification_cases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oob_verification_evidence" ADD CONSTRAINT "oob_verification_evidence_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oob_verification_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"roster_id" uuid,
	"user_id" uuid NOT NULL,
	"confirmation_text" text,
	"confirmed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "oob_confirm_case_user_idx" ON "oob_verification_confirmations" ("case_id","user_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oob_verification_confirmations" ADD CONSTRAINT "oob_verification_confirmations_case_id_oob_verification_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."oob_verification_cases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oob_verification_confirmations" ADD CONSTRAINT "oob_verification_confirmations_roster_id_safe_signer_roster_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."safe_signer_roster"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oob_verification_confirmations" ADD CONSTRAINT "oob_verification_confirmations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"reporter_user_id" uuid,
	"incident_type" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'reported' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"affected_safe_ids" json,
	"affected_signer_addresses" json,
	"linked_oob_case_id" uuid,
	"linked_safe_tx_hash" text,
	"security_contact_notified_at" timestamp,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "security_incidents_org_idx" ON "security_incidents" ("org_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_linked_oob_case_id_oob_verification_cases_id_fk" FOREIGN KEY ("linked_oob_case_id") REFERENCES "public"."oob_verification_cases"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_incident_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "security_incident_updates_incident_idx" ON "security_incident_updates" ("incident_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "security_incident_updates" ADD CONSTRAINT "security_incident_updates_incident_id_security_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."security_incidents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "security_incident_updates" ADD CONSTRAINT "security_incident_updates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
