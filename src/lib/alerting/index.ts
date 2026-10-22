/**
 * Proposal-time alerting (Level 1).
 * Poll Safe API → classify pending txs → normalize events → dispatch alerts (email + Slack).
 */

export { runPollCycle } from "./poller";
export { classifyTransaction } from "./classifier";
export { dispatchAlertsForEvent } from "./dispatcher";
export { sendAlertEmail, sendAlertSlack, getDefaultSlackWebhook } from "./notifications";
export { getPollIntervalMs, getDefaultNetwork, getSlackWebhookUrl, getEmailFrom, getResendApiKey } from "./config";
export { getSelector, SELECTORS, SELECTOR_TO_EVENT } from "./selectors";
export { SUBSCRIPTION_EVENT_TYPES } from "./types";
export type { EventType, EventCategory, ClassifiedEvent, NormalizedEventMetadata } from "./types";
