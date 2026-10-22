/**
 * Alert delivery: Email (Resend) and Slack webhook.
 */

import { getEmailFrom, getResendApiKey, getSlackWebhookUrl } from "./config";
import type { EventType } from "./types";
import type { NormalizedEventMetadata } from "./types";

export interface AlertPayload {
  eventType: EventType;
  safeAddress: string;
  network: string;
  proposedBy: string;
  decodedSummary?: string;
  metadata: NormalizedEventMetadata;
  timestamp: string;
  safeTxHash: string;
}

function htmlTemplate(payload: AlertPayload): string {
  const { eventType, safeAddress, network, proposedBy, decodedSummary, timestamp } = payload;
  const summary = decodedSummary ?? payload.metadata.decodedSummary ?? "—";
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Convixa Alert</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 560px;">
  <h2 style="color: #0f172a;">Multisig alert</h2>
  <p><strong>Event:</strong> ${eventType}</p>
  <p><strong>Safe:</strong> ${safeAddress}</p>
  <p><strong>Network:</strong> ${network}</p>
  <p><strong>Proposed by:</strong> ${proposedBy}</p>
  <p><strong>Summary:</strong> ${escapeHtml(summary)}</p>
  <p><strong>Time:</strong> ${timestamp}</p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 1em 0;">
  <p style="color: #64748b; font-size: 0.875rem;">Convixa · Proposal-time alerting</p>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendAlertEmail(to: string, payload: AlertPayload): Promise<{ ok: boolean; error?: string }> {
  const apiKey = getResendApiKey();
  const from = getEmailFrom();
  if (!apiKey) {
    console.error("[alerting] RESEND_API_KEY not set; cannot send email to", to, "— set RESEND_API_KEY in env.");
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const subject = `[Convixa] ${payload.eventType} — ${payload.safeAddress.slice(0, 10)}…`;
    const html = htmlTemplate(payload);
    const { error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });
    if (error) {
      console.error("[alerting] Resend error:", error);
      return { ok: false, error: String(error) };
    }
    return { ok: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[alerting] Email send failed:", err);
    return { ok: false, error: err };
  }
}

export async function sendAlertSlack(webhookUrl: string, payload: AlertPayload): Promise<{ ok: boolean; error?: string }> {
  const summary = payload.decodedSummary ?? payload.metadata.decodedSummary ?? "—";
  const body = {
    text: `Convixa alert: ${payload.eventType}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${payload.eventType}*\nSafe: \`${payload.safeAddress}\` (${payload.network})\nProposed by: ${payload.proposedBy}\nSummary: ${summary}\nTime: ${payload.timestamp}`,
        },
      },
    ],
  };
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `${res.status} ${text}` };
    }
    return { ok: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[alerting] Slack send failed:", err);
    return { ok: false, error: err };
  }
}

export function getDefaultSlackWebhook(): string | null {
  return getSlackWebhookUrl();
}
