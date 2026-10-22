ALTER TABLE "safes" ADD COLUMN IF NOT EXISTS "classification" text;
--> statement-breakpoint
ALTER TABLE "safes" ADD COLUMN IF NOT EXISTS "purpose" text;
--> statement-breakpoint
ALTER TABLE "safes" ADD COLUMN IF NOT EXISTS "module_exception_note" text;
--> statement-breakpoint
ALTER TABLE "safe_snapshots" ADD COLUMN IF NOT EXISTS "guard_address" text;
--> statement-breakpoint
ALTER TABLE "safe_snapshots" ADD COLUMN IF NOT EXISTS "fallback_handler" text;
--> statement-breakpoint
ALTER TABLE "safe_snapshots" ADD COLUMN IF NOT EXISTS "modules_json" json;
--> statement-breakpoint
ALTER TABLE "safe_snapshots" ADD COLUMN IF NOT EXISTS "last_owners_count" integer;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "safe_config_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"safe_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"source" text NOT NULL,
	"safe_tx_hash" text,
	"before_json" json,
	"after_json" json,
	"severity" text DEFAULT 'info' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "safe_config_events" ADD CONSTRAINT "safe_config_events_safe_id_safes_id_fk" FOREIGN KEY ("safe_id") REFERENCES "public"."safes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "safe_config_events" ADD CONSTRAINT "safe_config_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
