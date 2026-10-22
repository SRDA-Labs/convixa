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
import { safeConfigEvents } from "./safe-config-events.schema";
import { safeSignerRoster } from "./safe-signer-roster.schema";

export const checklistTemplates = pgTable(
  "checklist_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    classification: text("classification"),
    txCategories: json("tx_categories").$type<string[]>(),
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
  (table) => [index("checklist_templates_org_idx").on(table.orgId)]
);

export const pendingTxReviews = pgTable(
  "pending_tx_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    safeId: uuid("safe_id")
      .notNull()
      .references(() => safes.id, { onDelete: "cascade" }),
    safeTxHash: text("safe_tx_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    walletAddress: text("wallet_address"),
    templateId: uuid("template_id").references(() => checklistTemplates.id, {
      onDelete: "set null",
    }),
    itemsStateJson: json("items_state_json").$type<
      Record<
        string,
        { completed: boolean; autoResult?: boolean; note?: string; completedAt?: string }
      >
    >(),
    status: text("status").default("in_progress").notNull(),
    signingNote: text("signing_note"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("pending_tx_reviews_safe_tx_user_idx").on(
      table.safeId,
      table.safeTxHash,
      table.userId
    ),
    index("pending_tx_reviews_org_idx").on(table.orgId),
  ]
);

export const oobVerificationCases = pgTable(
  "oob_verification_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    safeId: uuid("safe_id")
      .notNull()
      .references(() => safes.id, { onDelete: "cascade" }),
    safeTxHash: text("safe_tx_hash"),
    configEventId: uuid("config_event_id").references(() => safeConfigEvents.id, {
      onDelete: "set null",
    }),
    normalizedEventId: uuid("normalized_event_id"),
    caseType: text("case_type").notNull(),
    status: text("status").default("open").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    requiredChannels: json("required_channels").$type<string[]>(),
    dueAt: timestamp("due_at"),
    openedByUserId: uuid("opened_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    verifiedAt: timestamp("verified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("oob_cases_org_idx").on(table.orgId),
    index("oob_cases_safe_idx").on(table.safeId),
    index("oob_cases_status_idx").on(table.status),
  ]
);

export const oobVerificationEvidence = pgTable(
  "oob_verification_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => oobVerificationCases.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    submittedByUserId: uuid("submitted_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    evidenceType: text("evidence_type").notNull(),
    evidenceValue: text("evidence_value").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("oob_evidence_case_idx").on(table.caseId)]
);

export const oobVerificationConfirmations = pgTable(
  "oob_verification_confirmations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => oobVerificationCases.id, { onDelete: "cascade" }),
    rosterId: uuid("roster_id").references(() => safeSignerRoster.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    confirmationText: text("confirmation_text"),
    confirmedAt: timestamp("confirmed_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("oob_confirm_case_user_idx").on(table.caseId, table.userId),
  ]
);

export const securityIncidents = pgTable(
  "security_incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    reporterUserId: uuid("reporter_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    incidentType: text("incident_type").notNull(),
    severity: text("severity").notNull(),
    status: text("status").default("reported").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    affectedSafeIds: json("affected_safe_ids").$type<string[]>(),
    affectedSignerAddresses: json("affected_signer_addresses").$type<string[]>(),
    linkedOobCaseId: uuid("linked_oob_case_id").references(
      () => oobVerificationCases.id,
      { onDelete: "set null" }
    ),
    linkedSafeTxHash: text("linked_safe_tx_hash"),
    securityContactNotifiedAt: timestamp("security_contact_notified_at"),
    resolvedAt: timestamp("resolved_at"),
    resolutionNotes: text("resolution_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("security_incidents_org_idx").on(table.orgId)]
);

export const securityIncidentUpdates = pgTable(
  "security_incident_updates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => securityIncidents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("security_incident_updates_incident_idx").on(table.incidentId)]
);

export const securityIncidentParticipants = pgTable(
  "security_incident_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => securityIncidents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").default("collaborator").notNull(),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("security_incident_participants_incident_user_key").on(
      table.incidentId,
      table.userId
    ),
    index("security_incident_participants_incident_idx").on(table.incidentId),
  ]
);

export const securityIncidentActivity = pgTable(
  "security_incident_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => securityIncidents.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    summary: text("summary").notNull(),
    metadata: json("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("security_incident_activity_incident_created_idx").on(
      table.incidentId,
      table.createdAt
    ),
  ]
);

export type TxSnapshot = {
  safeTxHash: string;
  to: string;
  value: string;
  txType: string;
  txCategory: string;
  nonce: number;
  confirmations: number;
  confirmationsRequired: number;
  submissionDate: string;
  executed?: boolean;
};

export const pendingTxThreads = pgTable(
  "pending_tx_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    safeId: uuid("safe_id")
      .notNull()
      .references(() => safes.id, { onDelete: "cascade" }),
    safeTxHash: text("safe_tx_hash").notNull(),
    status: text("status").default("open").notNull(),
    txSnapshot: json("tx_snapshot").$type<TxSnapshot | null>(),
    commentCount: integer("comment_count").default(0).notNull(),
    lastActivityAt: timestamp("last_activity_at"),
    openedByUserId: uuid("opened_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    executedAt: timestamp("executed_at"),
  },
  (table) => [
    uniqueIndex("pending_tx_threads_safe_tx_key").on(table.safeId, table.safeTxHash),
    index("pending_tx_threads_org_idx").on(table.orgId),
    index("pending_tx_threads_org_status_activity_idx").on(
      table.orgId,
      table.status,
      table.lastActivityAt
    ),
  ]
);

export const pendingTxThreadComments = pgTable(
  "pending_tx_thread_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => pendingTxThreads.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("pending_tx_thread_comments_thread_idx").on(table.threadId)]
);

export const pendingTxThreadActivity = pgTable(
  "pending_tx_thread_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => pendingTxThreads.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    summary: text("summary").notNull(),
    metadata: json("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("pending_tx_thread_activity_thread_created_idx").on(
      table.threadId,
      table.createdAt
    ),
  ]
);

export const pendingTxThreadParticipants = pgTable(
  "pending_tx_thread_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => pendingTxThreads.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").default("collaborator").notNull(),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("pending_tx_thread_participants_thread_user_key").on(
      table.threadId,
      table.userId
    ),
    index("pending_tx_thread_participants_thread_idx").on(table.threadId),
  ]
);
