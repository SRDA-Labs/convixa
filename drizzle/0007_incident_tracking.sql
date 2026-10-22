-- Incident tracking: participants, activity log
CREATE TABLE IF NOT EXISTS "security_incident_participants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "incident_id" uuid NOT NULL REFERENCES "security_incidents"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'collaborator',
  "invited_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "security_incident_participants_incident_user_key"
  ON "security_incident_participants" ("incident_id", "user_id");
CREATE INDEX IF NOT EXISTS "security_incident_participants_incident_idx"
  ON "security_incident_participants" ("incident_id");

CREATE TABLE IF NOT EXISTS "security_incident_activity" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "incident_id" uuid NOT NULL REFERENCES "security_incidents"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "action" text NOT NULL,
  "summary" text NOT NULL,
  "metadata" json,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "security_incident_activity_incident_created_idx"
  ON "security_incident_activity" ("incident_id", "created_at" DESC);
