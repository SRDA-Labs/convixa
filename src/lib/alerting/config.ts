/**
 * Alerting service configuration.
 */

const POLL_INTERVAL_MS = 15_000;
const SAFE_NETWORK_DEFAULT = "eth";

export function getPollIntervalMs(): number {
  const v = process.env.ALERT_POLL_INTERVAL_MS ?? process.env.POLL_INTERVAL;
  if (v == null || v === "") return POLL_INTERVAL_MS;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : POLL_INTERVAL_MS;
}

export function getDefaultNetwork(): string {
  return process.env.SAFE_NETWORK ?? process.env.NEXT_PUBLIC_CHAIN ?? SAFE_NETWORK_DEFAULT;
}

export function getSlackWebhookUrl(): string | null {
  const url = process.env.SLACK_WEBHOOK_URL ?? process.env.ALERT_SLACK_WEBHOOK_URL;
  return url && typeof url === "string" && url.startsWith("https://") ? url : null;
}

export function getEmailFrom(): string {
  return process.env.EMAIL_FROM ?? "Convixa <onboarding@resend.dev>";
}

export function getResendApiKey(): string | null {
  return process.env.RESEND_API_KEY ?? null;
}
