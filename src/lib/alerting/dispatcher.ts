/**
 * Alert dispatcher: for a new NormalizedEvent, find matching subscriptions and deliver.
 * When subscription_list_id is set, sends email to all list members (Resend).
 * Legacy: when subscription_list_id is null, uses channel/channelConfig (single email or Slack).
 * Idempotent: one AlertDelivery per (normalizedEventId, subscriptionId).
 */

import { eq, and, isNull, or } from "drizzle-orm";
import { db } from "../db";
import {
  normalizedEvents,
  alertSubscriptions,
  alertDeliveries,
  safes,
} from "../db/schema";
import { sendAlertEmail, sendAlertSlack, type AlertPayload } from "./notifications";
import { getSubscriptionListMembers } from "../db/repositories/subscription-lists.repository";

export interface DispatchResult {
  eventId: string;
  sent: number;
  failed: number;
  errors: string[];
}

/**
 * Build payload for notifications from DB rows.
 */
function buildPayload(
  event: { safeTxHash: string; eventType: string; metadata: unknown; createdAt: Date },
  safe: { address: string; network: string }
): AlertPayload {
  const meta = (event.metadata ?? {}) as Record<string, unknown>;
  return {
    eventType: event.eventType as AlertPayload["eventType"],
    safeAddress: safe.address,
    network: safe.network,
    proposedBy: String(meta.proposedBy ?? ""),
    decodedSummary: meta.decodedSummary != null ? String(meta.decodedSummary) : undefined,
    metadata: meta as unknown as AlertPayload["metadata"],
    timestamp: event.createdAt.toISOString(),
    safeTxHash: event.safeTxHash,
  };
}

/**
 * Dispatch alerts for a single normalized event. Finds subscriptions, sends, records deliveries.
 */
export async function dispatchAlertsForEvent(normalizedEventId: string): Promise<DispatchResult> {
  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  const eventRows = await db
    .select()
    .from(normalizedEvents)
    .where(eq(normalizedEvents.id, normalizedEventId))
    .limit(1);
  const event = eventRows[0];
  if (!event) {
    return { eventId: normalizedEventId, sent: 0, failed: 0, errors: ["Event not found"] };
  }

  const safeRows = await db
    .select({ address: safes.address, network: safes.network })
    .from(safes)
    .where(eq(safes.id, event.safeId))
    .limit(1);
  const safe = safeRows[0];
  if (!safe) {
    return { eventId: normalizedEventId, sent: 0, failed: 0, errors: ["Safe not found"] };
  }

  const payload = buildPayload(event, safe);

  const subscriptions = await db
    .select()
    .from(alertSubscriptions)
    .where(
      and(
        eq(alertSubscriptions.eventType, event.eventType),
        or(eq(alertSubscriptions.safeId, event.safeId), isNull(alertSubscriptions.safeId)),
        eq(alertSubscriptions.enabled, true)
      )
    );

  for (const sub of subscriptions) {
    const alreadySent = await db
      .select({ id: alertDeliveries.id })
      .from(alertDeliveries)
      .where(
        and(
          eq(alertDeliveries.normalizedEventId, normalizedEventId),
          eq(alertDeliveries.subscriptionId, sub.id)
        )
      )
      .limit(1);
    if (alreadySent.length > 0) continue;

    let deliveryOk = false;
    let deliveryError: string | null = null;

    if (sub.subscriptionListId) {
      const members = await getSubscriptionListMembers(sub.subscriptionListId);
      if (members.length === 0) {
        errors.push(`Subscription ${sub.id}: list has no members`);
        failed++;
        continue;
      }
      let anyOk = false;
      const errs: string[] = [];
      for (const { email } of members) {
        const result = await sendAlertEmail(email, payload);
        if (result.ok) anyOk = true;
        else if (result.error) errs.push(result.error);
      }
      deliveryOk = anyOk;
      deliveryError = errs.length > 0 ? errs.join("; ") : null;
    } else {
      const channelConfig = (sub.channelConfig ?? {}) as Record<string, unknown>;
      if (sub.channel === "email") {
        const to = channelConfig.email != null ? String(channelConfig.email) : null;
        if (!to) {
          errors.push(`Subscription ${sub.id}: missing email in channelConfig`);
          failed++;
          continue;
        }
        const result = await sendAlertEmail(to, payload);
        deliveryOk = result.ok;
        deliveryError = result.error ?? null;
      } else if (sub.channel === "slack") {
        const webhookUrl = channelConfig.webhookUrl != null ? String(channelConfig.webhookUrl) : null;
        if (!webhookUrl) {
          errors.push(`Subscription ${sub.id}: missing webhookUrl in channelConfig`);
          failed++;
          continue;
        }
        const result = await sendAlertSlack(webhookUrl, payload);
        deliveryOk = result.ok;
        deliveryError = result.error ?? null;
      } else {
        errors.push(`Subscription ${sub.id}: unknown channel ${sub.channel}`);
        failed++;
        continue;
      }
    }

    await db.insert(alertDeliveries).values({
      normalizedEventId,
      subscriptionId: sub.id,
      channel: "email",
      status: deliveryOk ? "sent" : "failed",
      response: deliveryError,
    });
    if (deliveryOk) sent++;
    else {
      failed++;
      if (deliveryError) errors.push(deliveryError);
    }
  }

  return { eventId: normalizedEventId, sent, failed, errors };
}
