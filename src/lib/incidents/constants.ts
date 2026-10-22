export const INCIDENT_STATUSES = [
  "reported",
  "triaging",
  "investigating",
  "contained",
  "resolved",
  "closed",
] as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  reported: "Reported",
  triaging: "Triaging",
  investigating: "Investigating",
  contained: "Contained",
  resolved: "Resolved",
  closed: "Closed",
};

export const INCIDENT_STATUS_DESCRIPTION: Record<IncidentStatus, string> = {
  reported: "Newly filed — awaiting initial review.",
  triaging: "Assessing severity, scope, and who needs to be involved.",
  investigating: "Active investigation — gathering evidence and coordinating response.",
  contained: "Threat or impact contained; monitoring for recurrence.",
  resolved: "Root cause addressed; documenting outcomes.",
  closed: "Incident closed with resolution notes.",
};

/** Statuses that require resolution notes when transitioning into them. */
export const RESOLUTION_REQUIRED_STATUSES: IncidentStatus[] = ["resolved", "closed"];

export const INCIDENT_ACTIVITY_ACTIONS = [
  "reported",
  "status_changed",
  "severity_changed",
  "description_updated",
  "comment_added",
  "participant_invited",
] as const;

export type IncidentActivityAction = (typeof INCIDENT_ACTIVITY_ACTIONS)[number];

export const INCIDENT_PARTICIPANT_ROLES = ["reporter", "collaborator"] as const;
export type IncidentParticipantRole = (typeof INCIDENT_PARTICIPANT_ROLES)[number];

export const INCIDENT_TYPES = [
  "key_compromise",
  "key_loss",
  "suspicious_tx",
  "comms_compromise",
  "oob_failure",
  "other",
] as const;

export const INCIDENT_TYPE_LABEL: Record<(typeof INCIDENT_TYPES)[number], string> = {
  key_compromise: "Key compromise",
  key_loss: "Key loss",
  suspicious_tx: "Suspicious transaction",
  comms_compromise: "Comms compromise",
  oob_failure: "OOB failure",
  other: "Other",
};

export const INCIDENT_SEVERITIES = ["low", "medium", "high", "critical"] as const;
