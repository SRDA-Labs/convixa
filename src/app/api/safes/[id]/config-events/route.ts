import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { requireAuth, validateSafeAccess } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import { db } from "@/lib/db";
import { normalizedEvents } from "@/lib/db/schema";
import { getConfigEventsBySafe } from "@/lib/db/repositories/safe-config-events.repository";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });
  }

  const access = await validateSafeAccess(parsed.data);
  if (access instanceof NextResponse) return access;

  const [events, proposed] = await Promise.all([
    getConfigEventsBySafe(parsed.data, 50),
    db
      .select()
      .from(normalizedEvents)
      .where(eq(normalizedEvents.safeId, parsed.data))
      .orderBy(desc(normalizedEvents.createdAt))
      .limit(20),
  ]);

  const governanceProposed = proposed.filter((e) =>
    [
      "SIGNER_ADD_PROPOSED",
      "SIGNER_REMOVE_PROPOSED",
      "THRESHOLD_CHANGE_PROPOSED",
      "SIGNER_SWAP_PROPOSED",
      "GUARD_SET_PROPOSED",
      "FALLBACK_HANDLER_SET_PROPOSED",
      "MODULE_CHANGE_PROPOSED",
    ].includes(e.eventType)
  );

  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      source: e.source,
      safeTxHash: e.safeTxHash,
      beforeJson: e.beforeJson,
      afterJson: e.afterJson,
      severity: e.severity,
      createdAt: e.createdAt,
    })),
    proposed: governanceProposed.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      safeTxHash: e.safeTxHash,
      metadata: e.metadata,
      createdAt: e.createdAt,
    })),
  });
}
