/**
 * Example seed for proposal-time alert subscriptions.
 * Run: npx tsx scripts/seed-alert-subscriptions.ts
 * Requires: DATABASE_URL, and at least one org id (pass as first arg or set SEED_ORG_ID).
 *
 * Creates example subscriptions for event types ERC20_TRANSFER_PROPOSED and CONTRACT_CALL_PROPOSED
 * to email and Slack. Adjust eventType, channel, and channelConfig for your org.
 */

import { config } from "dotenv";
import { createAlertSubscription } from "../src/lib/db/repositories/alerts.repository";

config({ path: ".env" });

async function main() {
  const orgId = process.argv[2] ?? process.env.SEED_ORG_ID;
  if (!orgId) {
    console.error("Usage: npx tsx scripts/seed-alert-subscriptions.ts <orgId>");
    console.error("   or set SEED_ORG_ID in .env");
    process.exit(1);
  }

  const email = process.env.ALERT_EMAIL ?? process.env.ADMIN_EMAIL ?? "admin@example.com";
  const webhookUrl = process.env.SLACK_WEBHOOK_URL ?? null;

  const subs = [];

  if (email) {
    subs.push(
      await createAlertSubscription({
        organizationId: orgId,
        safeId: null,
        eventType: "ERC20_TRANSFER_PROPOSED",
        channel: "email",
        channelConfig: { email },
        enabled: true,
      })
    );
    subs.push(
      await createAlertSubscription({
        organizationId: orgId,
        safeId: null,
        eventType: "CONTRACT_CALL_PROPOSED",
        channel: "email",
        channelConfig: { email },
        enabled: true,
      })
    );
  }

  if (webhookUrl) {
    subs.push(
      await createAlertSubscription({
        organizationId: orgId,
        safeId: null,
        eventType: "ETH_TRANSFER_PROPOSED",
        channel: "slack",
        channelConfig: { webhookUrl },
        enabled: true,
      })
    );
  }

  console.log("Created", subs.filter(Boolean).length, "alert subscription(s) for org", orgId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
