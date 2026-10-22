import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  json,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { orgs } from "./orgs.schema";
import { safes } from "./safes.schema";
import { users } from "./users.schema";
import { safeSignerRoster } from "./safe-signer-roster.schema";

export const signerOnboardingTemplates = pgTable(
  "signer_onboarding_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    itemsJson: json("items_json").$type<
      Array<{
        id: string;
        label: string;
        type: "auto" | "manual";
        autoRule?: string;
        required?: boolean;
      }>
    >(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("signer_onboarding_templates_org_idx").on(table.orgId)]
);

export const signerOnboardingProgress = pgTable(
  "signer_onboarding_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    rosterId: uuid("roster_id")
      .notNull()
      .references(() => safeSignerRoster.id, { onDelete: "cascade" }),
    safeId: uuid("safe_id")
      .notNull()
      .references(() => safes.id, { onDelete: "cascade" }),
    signerAddress: text("signer_address").notNull(),
    templateId: uuid("template_id").references(() => signerOnboardingTemplates.id, {
      onDelete: "set null",
    }),
    itemsStateJson: json("items_state_json").$type<
      Record<
        string,
        { completed: boolean; autoResult?: boolean; note?: string; completedAt?: string }
      >
    >(),
    status: text("status").default("in_progress").notNull(),
    completedAt: timestamp("completed_at"),
    completedByUserId: uuid("completed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("signer_onboarding_progress_roster_idx").on(table.rosterId),
    index("signer_onboarding_progress_org_idx").on(table.orgId),
    index("signer_onboarding_progress_safe_idx").on(table.safeId),
  ]
);

export const emergencyDrillSchedules = pgTable(
  "emergency_drill_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    safeId: uuid("safe_id").references(() => safes.id, { onDelete: "cascade" }),
    drillType: text("drill_type").notNull(),
    cadence: text("cadence").notNull(),
    title: text("title").notNull(),
    nextDueAt: timestamp("next_due_at"),
    lastCompletedAt: timestamp("last_completed_at"),
    ownerUserId: uuid("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("emergency_drill_schedules_org_idx").on(table.orgId),
    index("emergency_drill_schedules_safe_idx").on(table.safeId),
  ]
);

export const emergencyDrillRuns = pgTable(
  "emergency_drill_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scheduleId: uuid("schedule_id").references(() => emergencyDrillSchedules.id, {
      onDelete: "set null",
    }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    safeId: uuid("safe_id").references(() => safes.id, { onDelete: "cascade" }),
    drillType: text("drill_type").notNull(),
    title: text("title").notNull(),
    scheduledAt: timestamp("scheduled_at"),
    completedAt: timestamp("completed_at"),
    status: text("status").default("scheduled").notNull(),
    participantsJson: json("participants_json").$type<
      Array<{ userId?: string; name?: string; role?: string }>
    >(),
    findingsJson: json("findings_json").$type<
      Array<{ severity: string; note: string; followUpDueAt?: string }>
    >(),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("emergency_drill_runs_org_idx").on(table.orgId),
    index("emergency_drill_runs_schedule_idx").on(table.scheduleId),
  ]
);

export const disasterRecoveryPlaybooks = pgTable(
  "disaster_recovery_playbooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    scope: text("scope").default("org").notNull(),
    safeId: uuid("safe_id").references(() => safes.id, { onDelete: "cascade" }),
    classification: text("classification"),
    scenario: text("scenario").notNull(),
    title: text("title").notNull(),
    version: integer("version").default(1).notNull(),
    contentMd: text("content_md").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    publishedAt: timestamp("published_at").defaultNow().notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("disaster_recovery_playbooks_org_idx").on(table.orgId),
    uniqueIndex("disaster_recovery_playbooks_org_scenario_version_idx").on(
      table.orgId,
      table.scenario,
      table.version
    ),
  ]
);

export const readinessSnapshots = pgTable(
  "readiness_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    computedAt: timestamp("computed_at").defaultNow().notNull(),
    metricsJson: json("metrics_json").$type<Record<string, unknown>>(),
  },
  (table) => [index("readiness_snapshots_org_idx").on(table.orgId)]
);
