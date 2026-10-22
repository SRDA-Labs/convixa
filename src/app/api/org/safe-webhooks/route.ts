import { NextResponse } from "next/server";
import { requireAuthAndOrg } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import {
  createWebhookSubscription,
  deleteWebhookSubscription,
  getWebhookSubscriptionsByOrg,
} from "@/lib/db/repositories/governance.repository";
import { db } from "@/lib/db";
import { safes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getWebhookBaseUrl, isSafeWebhooksEnabled } from "@/lib/governance-delay/config";

export async function GET() {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:read", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const subscriptions = await getWebhookSubscriptionsByOrg(auth.orgId);
  const baseUrl = getWebhookBaseUrl();

  return NextResponse.json({
    enabled: isSafeWebhooksEnabled(),
    webhookEndpoint: baseUrl,
    subscriptions: subscriptions.map((s) => ({
      ...s,
      webhookSecret: undefined,
      webhookUrl: baseUrl ? `${baseUrl}?secret=${s.webhookSecret}` : null,
    })),
  });
}

const createSchema = z.object({
  safeId: z.string().uuid(),
  eventTypes: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:manage", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isSafeWebhooksEnabled()) {
    return NextResponse.json({ error: "Webhooks disabled" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const [safe] = await db
    .select()
    .from(safes)
    .where(and(eq(safes.id, parsed.data.safeId), eq(safes.orgId, auth.orgId)))
    .limit(1);

  if (!safe) {
    return NextResponse.json({ error: "Safe not found" }, { status: 404 });
  }

  const sub = await createWebhookSubscription({
    orgId: auth.orgId,
    safeId: safe.id,
    network: safe.network,
    safeAddress: safe.address,
    eventTypes: parsed.data.eventTypes,
  });

  const baseUrl = getWebhookBaseUrl();
  return NextResponse.json(
    {
      subscription: {
        ...sub,
        webhookUrl: baseUrl ? `${baseUrl}?secret=${sub.webhookSecret}` : null,
      },
    },
    { status: 201 }
  );
}

export async function DELETE(req: Request) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:manage", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const deleted = await deleteWebhookSubscription(id, auth.orgId);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
