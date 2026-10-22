-- SEAL Phase 4: Readiness, training & drills

CREATE TABLE IF NOT EXISTS "signer_onboarding_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "items_json" json,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "signer_onboarding_templates_org_idx" ON "signer_onboarding_templates" ("org_id");

CREATE TABLE IF NOT EXISTS "signer_onboarding_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "roster_id" uuid NOT NULL REFERENCES "safe_signer_roster"("id") ON DELETE CASCADE,
  "safe_id" uuid NOT NULL REFERENCES "safes"("id") ON DELETE CASCADE,
  "signer_address" text NOT NULL,
  "template_id" uuid REFERENCES "signer_onboarding_templates"("id") ON DELETE SET NULL,
  "items_state_json" json,
  "status" text DEFAULT 'in_progress' NOT NULL,
  "completed_at" timestamp,
  "completed_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "signer_onboarding_progress_roster_idx" ON "signer_onboarding_progress" ("roster_id");
CREATE INDEX IF NOT EXISTS "signer_onboarding_progress_org_idx" ON "signer_onboarding_progress" ("org_id");
CREATE INDEX IF NOT EXISTS "signer_onboarding_progress_safe_idx" ON "signer_onboarding_progress" ("safe_id");

CREATE TABLE IF NOT EXISTS "emergency_drill_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "safe_id" uuid REFERENCES "safes"("id") ON DELETE CASCADE,
  "drill_type" text NOT NULL,
  "cadence" text NOT NULL,
  "title" text NOT NULL,
  "next_due_at" timestamp,
  "last_completed_at" timestamp,
  "owner_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "emergency_drill_schedules_org_idx" ON "emergency_drill_schedules" ("org_id");
CREATE INDEX IF NOT EXISTS "emergency_drill_schedules_safe_idx" ON "emergency_drill_schedules" ("safe_id");

CREATE TABLE IF NOT EXISTS "emergency_drill_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "schedule_id" uuid REFERENCES "emergency_drill_schedules"("id") ON DELETE SET NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "safe_id" uuid REFERENCES "safes"("id") ON DELETE CASCADE,
  "drill_type" text NOT NULL,
  "title" text NOT NULL,
  "scheduled_at" timestamp,
  "completed_at" timestamp,
  "status" text DEFAULT 'scheduled' NOT NULL,
  "participants_json" json,
  "findings_json" json,
  "notes" text,
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "emergency_drill_runs_org_idx" ON "emergency_drill_runs" ("org_id");
CREATE INDEX IF NOT EXISTS "emergency_drill_runs_schedule_idx" ON "emergency_drill_runs" ("schedule_id");

CREATE TABLE IF NOT EXISTS "disaster_recovery_playbooks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "scope" text DEFAULT 'org' NOT NULL,
  "safe_id" uuid REFERENCES "safes"("id") ON DELETE CASCADE,
  "classification" text,
  "scenario" text NOT NULL,
  "title" text NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "content_md" text NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "published_at" timestamp DEFAULT now() NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "disaster_recovery_playbooks_org_idx" ON "disaster_recovery_playbooks" ("org_id");
CREATE UNIQUE INDEX IF NOT EXISTS "disaster_recovery_playbooks_org_scenario_version_idx" ON "disaster_recovery_playbooks" ("org_id", "scenario", "version");

CREATE TABLE IF NOT EXISTS "readiness_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "computed_at" timestamp DEFAULT now() NOT NULL,
  "metrics_json" json
);
CREATE INDEX IF NOT EXISTS "readiness_snapshots_org_idx" ON "readiness_snapshots" ("org_id");
