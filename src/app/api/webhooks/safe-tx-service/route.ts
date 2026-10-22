import { NextResponse } from "next/server";
import {
  getWebhookSubscriptionBySecret,
} from "@/lib/db/repositories/governance.repository";
import { processIncomingWebhook } from "@/lib/safe-webhooks/process-event";
import { verifyWebhookSignature } from "@/lib/safe-webhooks/verify";
import { isSafeWebhooksEnabled } from "@/lib/governance-delay/config";

export async function POST(req: Request) {
  if (!isSafeWebhooksEnabled()) {
    return NextResponse.json({ error: "Disabled" }, { status: 503 });
  }

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (!secret) {
    return NextResponse.json({ error: "Missing secret" }, { status: 401 });
  }

  const subscription = await getWebhookSubscriptionBySecret(secret);
  if (!subscription) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 401 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-safe-signature") ?? req.headers.get("x-signature");

  if (signature && !verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const event = await processIncomingWebhook({
      subscriptionId: subscription.id,
      orgId: subscription.orgId,
      payload,
    });
    return NextResponse.json({ ok: true, eventId: event.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Processing failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
