/**
 * POST /api/alerts/subscriptions/[id]/test
 * Send a test email (or Slack) for this subscription so the user can verify delivery.
 * When subscription uses a list, sends test email to all list members.
 */

import { NextResponse } from "next/server";
import { requireAuthOrgPermission } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { alertSubscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { uuidSchema } from "@/lib/validations";
import { sendAlertEmail, sendAlertSlack } from "@/lib/alerting/notifications";
import { getSubscriptionListMembers } from "@/lib/db/repositories/subscription-lists.repository";

const TEST_PAYLOAD = {
  eventType: "CONTRACT_CALL_PROPOSED" as const,
  safeAddress: "0x0000000000000000000000000000000000000000",
  network: "eth",
  proposedBy: "0x0000000000000000000000000000000000000000",
  decodedSummary: "Test alert — if you received this, your notification is set up correctly.",
  metadata: {
    proposedBy: "0x0000000000000000000000000000000000000000",
    value: "0",
    toAddress: "0x0000000000000000000000000000000000000000",
  },
  timestamp: new Date().toISOString(),
  safeTxHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
};

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const { id } = await params;
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });

  const [sub] = await db
    .select()
    .from(alertSubscriptions)
    .where(eq(alertSubscriptions.id, idParsed.data))
    .limit(1);
  if (!sub || sub.organizationId !== orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (sub.subscriptionListId) {
    const members = await getSubscriptionListMembers(sub.subscriptionListId);
    if (members.length === 0) return NextResponse.json({ error: "Recipient list has no emails" }, { status: 400 });
    let anyOk = false;
    for (const { email } of members) {
      const sendResult = await sendAlertEmail(email, TEST_PAYLOAD);
      if (sendResult.ok) anyOk = true;
    }
    if (!anyOk) return NextResponse.json({ error: "Failed to send test email to any recipient" }, { status: 500 });
    return NextResponse.json({ ok: true, message: "Test email sent to list members" });
  }

  const channelConfig = (sub.channelConfig ?? {}) as Record<string, unknown>;
  if (sub.channel === "email") {
    const to = channelConfig.email != null ? String(channelConfig.email) : null;
    if (!to) return NextResponse.json({ error: "Subscription has no email" }, { status: 400 });
    const sendResult = await sendAlertEmail(to, TEST_PAYLOAD);
    if (!sendResult.ok) {
      return NextResponse.json({ error: sendResult.error ?? "Failed to send test email" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, message: "Test email sent" });
  }
  if (sub.channel === "slack") {
    const webhookUrl = channelConfig.webhookUrl != null ? String(channelConfig.webhookUrl) : null;
    if (!webhookUrl) return NextResponse.json({ error: "Subscription has no webhook URL" }, { status: 400 });
    const sendResult = await sendAlertSlack(webhookUrl, TEST_PAYLOAD);
    if (!sendResult.ok) {
      return NextResponse.json({ error: sendResult.error ?? "Failed to send test message" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, message: "Test message sent to Slack" });
  }
  return NextResponse.json({ error: "Unknown channel" }, { status: 400 });
}
