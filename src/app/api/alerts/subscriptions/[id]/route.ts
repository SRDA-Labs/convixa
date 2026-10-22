import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthOrgPermission, parseRequestBody } from "@/lib/api-helpers";
import { updateAlertSubscription, deleteAlertSubscription } from "@/lib/db/repositories";
import { getSubscriptionListById } from "@/lib/db/repositories/subscription-lists.repository";
import { db } from "@/lib/db";
import { alertSubscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { uuidSchema } from "@/lib/validations";
import { SUBSCRIPTION_EVENT_TYPES } from "@/lib/alerting";

const updateSchema = z.object({
  eventType: z.enum(SUBSCRIPTION_EVENT_TYPES).optional(),
  subscriptionListId: z.string().uuid().nullable().optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const { id } = await params;
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });

  const [existing] = await db
    .select()
    .from(alertSubscriptions)
    .where(eq(alertSubscriptions.id, idParsed.data))
    .limit(1);
  if (!existing || existing.organizationId !== orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parseResult = await parseRequestBody(req, updateSchema);
  if ("error" in parseResult) return parseResult.error;
  const body = parseResult.data;

  if (body.subscriptionListId !== undefined && body.subscriptionListId !== null) {
    const list = await getSubscriptionListById(body.subscriptionListId);
    if (!list || list.organizationId !== orgId) {
      return NextResponse.json({ error: "Subscription list not found or not in this org" }, { status: 404 });
    }
  }

  const updateData: { eventType?: string; subscriptionListId?: string | null; enabled?: boolean } = {};
  if (body.eventType !== undefined) updateData.eventType = body.eventType;
  if (body.subscriptionListId !== undefined) updateData.subscriptionListId = body.subscriptionListId;
  if (body.enabled !== undefined) updateData.enabled = body.enabled;

  const updated = await updateAlertSubscription(idParsed.data, updateData);
  if (!updated) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  return NextResponse.json({
    subscription: {
      id: updated.id,
      organizationId: updated.organizationId,
      safeId: updated.safeId,
      subscriptionListId: updated.subscriptionListId,
      eventType: updated.eventType,
      channel: updated.channel,
      channelConfig: updated.channelConfig as Record<string, unknown>,
      enabled: updated.enabled,
      createdAt: updated.createdAt.toISOString(),
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const { id } = await params;
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });

  const [existing] = await db
    .select({ id: alertSubscriptions.id, organizationId: alertSubscriptions.organizationId })
    .from(alertSubscriptions)
    .where(eq(alertSubscriptions.id, idParsed.data))
    .limit(1);
  if (!existing || existing.organizationId !== orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ok = await deleteAlertSubscription(idParsed.data);
  if (!ok) return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
