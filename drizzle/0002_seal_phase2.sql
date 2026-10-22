CREATE TABLE IF NOT EXISTS "safe_signer_roster" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"safe_id" uuid NOT NULL,
	"signer_address" text NOT NULL,
	"display_name" text,
	"signer_type" text DEFAULT 'unknown' NOT NULL,
	"role_label" text,
	"org_member_user_id" uuid,
	"hardware_wallet" text,
	"is_dedicated_signer" boolean,
	"verification_status" text DEFAULT 'unverified' NOT NULL,
	"verification_method" text,
	"verified_at" timestamp,
	"verified_by_user_id" uuid,
	"notes" text,
	"source" text DEFAULT 'snapshot_sync' NOT NULL,
	"removed_at" timestamp,
	"pending_affiliation_request_id" text,
	"pending_affiliation_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "safe_signer_roster_safe_signer_idx" ON "safe_signer_roster" ("safe_id","signer_address");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "safe_signer_roster_org_idx" ON "safe_signer_roster" ("org_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "safe_signer_roster" ADD CONSTRAINT "safe_signer_roster_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "safe_signer_roster" ADD CONSTRAINT "safe_signer_roster_safe_id_safes_id_fk" FOREIGN KEY ("safe_id") REFERENCES "public"."safes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "safe_signer_roster" ADD CONSTRAINT "safe_signer_roster_org_member_user_id_users_id_fk" FOREIGN KEY ("org_member_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "safe_signer_roster" ADD CONSTRAINT "safe_signer_roster_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "signer_affiliation_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roster_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"safe_id" uuid NOT NULL,
	"signer_address" text NOT NULL,
	"message_text" text NOT NULL,
	"message_hash" text NOT NULL,
	"signature" text NOT NULL,
	"signed_by_user_id" uuid,
	"verified_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "signer_affiliation_proofs_roster_idx" ON "signer_affiliation_proofs" ("roster_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "signer_affiliation_proofs" ADD CONSTRAINT "signer_affiliation_proofs_roster_id_safe_signer_roster_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."safe_signer_roster"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "signer_affiliation_proofs" ADD CONSTRAINT "signer_affiliation_proofs_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "signer_affiliation_proofs" ADD CONSTRAINT "signer_affiliation_proofs_safe_id_safes_id_fk" FOREIGN KEY ("safe_id") REFERENCES "public"."safes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "signer_affiliation_proofs" ADD CONSTRAINT "signer_affiliation_proofs_signed_by_user_id_users_id_fk" FOREIGN KEY ("signed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "signer_verification_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roster_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "signer_verification_requests_token_idx" ON "signer_verification_requests" ("token_hash");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "signer_verification_requests" ADD CONSTRAINT "signer_verification_requests_roster_id_safe_signer_roster_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."safe_signer_roster"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "signer_verification_requests" ADD CONSTRAINT "signer_verification_requests_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "signer_verification_requests" ADD CONSTRAINT "signer_verification_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "signer_eoa_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"signer_address" text NOT NULL,
	"network" text NOT NULL,
	"last_checked_at" timestamp,
	"last_outgoing_tx_at" timestamp,
	"last_outgoing_tx_hash" text,
	"activity_count_7d" integer DEFAULT 0,
	"raw_summary" json,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "signer_eoa_activity_addr_network_idx" ON "signer_eoa_activity" ("signer_address","network");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "signer_eoa_activity_org_idx" ON "signer_eoa_activity" ("org_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "signer_eoa_activity" ADD CONSTRAINT "signer_eoa_activity_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
