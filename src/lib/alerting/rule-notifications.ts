/**
 * First-fire email for alert rules (pending_tx, queue_stuck).
 * Sends to all recipients in the rule's subscription list. Uses Resend.
 */

import { getEmailFrom, getResendApiKey } from "./config";

export interface RuleFirstFireParams {
  rule: { name: string | null; type: string };
  safe: { name: string | null; address: string; network: string };
  reason: string;
  recipients: string[];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ruleTypeLabel(type: string): string {
  return type === "pending_tx" ? "Pending transactions" : type === "queue_stuck" ? "Queue stuck" : type;
}

function getDashboardUrl(): string {
  const base = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3001";
  return `${base.replace(/\/$/, "")}/dashboard/alerts`;
}

/**
 * Send first-fire notification email to each recipient. One email per recipient.
 * Returns count of successful sends and any errors.
 */
export async function sendRuleFirstFireEmail(params: RuleFirstFireParams): Promise<{ sent: number; errors: string[] }> {
  const { rule, safe, reason, recipients } = params;
  const apiKey = getResendApiKey();
  const from = getEmailFrom();
  const ruleLabel = rule.name ?? ruleTypeLabel(rule.type);
  const safeLabel = safe.name ?? `${safe.address.slice(0, 10)}…`;
  const timestamp = new Date().toISOString();
  const dashboardUrl = getDashboardUrl();

  const subject = `Alert Rule Triggered: ${ruleLabel}`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Alert Rule Triggered</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 560px;">
  <h2 style="color: #0f172a;">Alert rule triggered</h2>
  <p><strong>Rule:</strong> ${escapeHtml(ruleLabel)}</p>
  <p><strong>Safe:</strong> ${escapeHtml(safeLabel)} (${escapeHtml(safe.network)})</p>
  <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
  <p><strong>Time:</strong> ${escapeHtml(timestamp)}</p>
  <p><a href="${escapeHtml(dashboardUrl)}" style="color: #2563eb;">View in Convixa</a></p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 1em 0;">
  <p style="color: #64748b; font-size: 0.875rem;">Convixa · Alert rules</p>
</body>
</html>`;

  if (!apiKey) {
    console.log("[alerting/rule-notifications] RESEND_API_KEY not set; would send first-fire email to", recipients.length, "recipients");
    return { sent: 0, errors: [] };
  }

  let sentCount = 0;
  const errorList: string[] = [];

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    for (const to of recipients) {
      if (!to || typeof to !== "string" || !to.includes("@")) continue;
      const trimmed = to.trim().toLowerCase();
      if (!trimmed) continue;

      const { error } = await resend.emails.send({
        from,
        to: trimmed,
        subject,
        html,
      });
      if (error) {
        errorList.push(`${trimmed}: ${String(error)}`);
        console.error("[alerting/rule-notifications] Resend error for", trimmed, error);
      } else {
        sentCount++;
      }
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    errorList.push(err);
    console.error("[alerting/rule-notifications] Send failed:", err);
  }

  return { sent: sentCount, errors: errorList };
}
