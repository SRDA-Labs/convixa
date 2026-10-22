/**
 * Policy Notification Dispatch: sends email notifications for policy fire events.
 *
 * When a policy fires (alert or block) and has an associated subscription list,
 * send email to all list members via Resend.
 */

import { getUnnotifiedPolicyFireLogs, markNotificationSent } from "../db/repositories/policy-fire-log.repository";
import { getSubscriptionListMembers } from "../db/repositories/subscription-lists.repository";
import { getEmailFrom, getResendApiKey } from "./config";

export interface PolicyNotificationResult {
  processed: number;
  sent: number;
  failed: number;
  errors: string[];
}

function policyEmailHtml(log: {
  policyName: string;
  safeAddress: string;
  safeName: string | null;
  safeTxHash: string | null;
  triggerType: string;
  actionType: string;
  actionDetails: unknown;
}): string {
  const details = (log.actionDetails ?? {}) as Record<string, unknown>;
  const actionLabel = log.actionType === "block" ? "BLOCKED" : "ALERT";
  const safeLabel = log.safeName ?? log.safeAddress.slice(0, 10) + "…";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Convixa Policy Alert</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 560px;">
  <h2 style="color: #0f172a;">Policy enforcement: ${log.policyName}</h2>
  <p><strong>Action:</strong> ${actionLabel}</p>
  <p><strong>Safe:</strong> ${safeLabel} (${log.safeAddress})</p>
  ${log.safeTxHash ? `<p><strong>Transaction:</strong> ${log.safeTxHash.slice(0, 16)}…</p>` : ""}
  <p><strong>Trigger:</strong> ${log.triggerType}</p>
  <p><strong>Reason:</strong> ${details.reason ?? "Policy conditions matched"}</p>
  ${details.to ? `<p><strong>To:</strong> ${details.to}</p>` : ""}
  ${details.value ? `<p><strong>Value:</strong> ${details.value}</p>` : ""}
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 1em 0;">
  <p style="color: #64748b; font-size: 0.875rem;">Convixa · Policy auto-enforcement</p>
</body>
</html>`;
}

async function sendPolicyEmail(to: string, log: {
  policyName: string;
  safeAddress: string;
  safeName: string | null;
  safeTxHash: string | null;
  triggerType: string;
  actionType: string;
  actionDetails: unknown;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = getResendApiKey();
  const from = getEmailFrom();
  if (!apiKey) {
    console.error("[policy-notifications] RESEND_API_KEY not set; cannot send email to", to);
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const subject = `[Convixa] ${log.actionType === "block" ? "BLOCKED" : "ALERT"} — ${log.policyName} — ${log.safeAddress.slice(0, 10)}…`;
    const html = policyEmailHtml(log);
    const { error } = await resend.emails.send({ from, to, subject, html });
    if (error) {
      console.error("[policy-notifications] Resend error:", error);
      return { ok: false, error: String(error) };
    }
    return { ok: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[policy-notifications] Email send failed:", err);
    return { ok: false, error: err };
  }
}

/**
 * Dispatch email notifications for all unnotified policy fire logs.
 * Called by the poller after policy enforcement.
 */
export async function dispatchPolicyNotifications(): Promise<PolicyNotificationResult> {
  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  const unnotified = await getUnnotifiedPolicyFireLogs(100);
  const processed = unnotified.length;

  for (const log of unnotified) {
    // Skip if no subscription list configured on the policy
    if (!log.policySubscriptionListId) {
      await markNotificationSent(log.id);
      continue;
    }

    try {
      const members = await getSubscriptionListMembers(log.policySubscriptionListId);
      if (members.length === 0) {
        await markNotificationSent(log.id);
        continue;
      }

      let anySent = false;
      for (const { email } of members) {
        const result = await sendPolicyEmail(email, {
          policyName: log.policyName,
          safeAddress: log.safeAddress,
          safeName: log.safeName,
          safeTxHash: log.safeTxHash,
          triggerType: log.triggerType,
          actionType: log.actionType,
          actionDetails: log.actionDetails,
        });
        if (result.ok) {
          anySent = true;
        } else {
          failed++;
          if (result.error) errors.push(result.error);
        }
      }

      if (anySent) sent++;
      await markNotificationSent(log.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Policy fire ${log.id}: ${msg}`);
      failed++;
    }
  }

  return { processed, sent, failed, errors };
}
