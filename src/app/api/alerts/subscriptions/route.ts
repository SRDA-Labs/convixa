import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthOrgPermission, parseRequestBody } from "@/lib/api-helpers";
import {
  createAlertSubscription,
  getAlertSubscriptionsByOrg,
} from "@/lib/db/repositories";
import { getSubscriptionListById } from "@/lib/db/repositories/subscription-lists.repository";
import { db } from "@/lib/db";
import { safes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { SUBSCRIPTION_EVENT_TYPES } from "@/lib/alerting";

const createSchema = z.object({
  eventType: z.enum(SUBSCRIPTION_EVENT_TYPES),
  safeId: z.string().uuid().nullable().optional(),
  subscriptionListId: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const list = await getAlertSubscriptionsByOrg(orgId);
  return NextResponse.json({
    subscriptions: list.map((s) => ({
      id: s.id,
      organizationId: s.organizationId,
      safeId: s.safeId,
      subscriptionListId: s.subscriptionListId,
      eventType: s.eventType,
      channel: s.channel,
      channelConfig: s.channelConfig as Record<string, unknown>,
      enabled: s.enabled,
      createdAt: s.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const parseResult = await parseRequestBody(req, createSchema);
  if ("error" in parseResult) return parseResult.error;
  const body = parseResult.data;

  if (body.safeId) {
    const [safe] = await db.select({ id: safes.id, orgId: safes.orgId }).from(safes).where(eq(safes.id, body.safeId)).limit(1);
    if (!safe || safe.orgId !== orgId) {
      return NextResponse.json({ error: "Safe not found or not in this org" }, { status: 404 });
    }
  }

  if (body.subscriptionListId) {
    const list = await getSubscriptionListById(body.subscriptionListId);
    if (!list || list.organizationId !== orgId) {
      return NextResponse.json({ error: "Subscription list not found or not in this org" }, { status: 404 });
    }
  }

  const sub = await createAlertSubscription({
    organizationId: orgId,
    safeId: body.safeId ?? null,
    subscriptionListId: body.subscriptionListId ?? null,
    eventType: body.eventType,
    channel: "email",
    channelConfig: {},
    enabled: true,
  });

  if (!sub) return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });

  return NextResponse.json({
    subscription: {
      id: sub.id,
      organizationId: sub.organizationId,
      safeId: sub.safeId,
      subscriptionListId: sub.subscriptionListId,
      eventType: sub.eventType,
      channel: sub.channel,
      channelConfig: sub.channelConfig as Record<string, unknown>,
      enabled: sub.enabled,
      createdAt: sub.createdAt.toISOString(),
    },
  });
}
