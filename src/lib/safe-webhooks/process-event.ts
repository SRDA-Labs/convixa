import {
  insertWebhookEvent,
  markWebhookEventProcessed,
  touchWebhookReceived,
} from "@/lib/db/repositories/governance.repository";
import { parseWebhookPayload } from "./verify";

export async function processIncomingWebhook(params: {
  subscriptionId: string;
  orgId: string;
  payload: unknown;
}) {
  const parsed = parseWebhookPayload(params.payload);

  const event = await insertWebhookEvent({
    orgId: params.orgId,
    subscriptionId: params.subscriptionId,
    eventType: parsed.eventType,
    payloadJson: params.payload as Record<string, unknown>,
    safeAddress: parsed.safeAddress,
    safeTxHash: parsed.safeTxHash,
  });

  await touchWebhookReceived(params.subscriptionId);

  try {
    // Future: trigger alert re-evaluation or snapshot refresh for governance events.
    await markWebhookEventProcessed(event.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Processing failed";
    await markWebhookEventProcessed(event.id, msg);
    throw e;
  }

  return event;
}
