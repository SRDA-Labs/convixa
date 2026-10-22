import { NextResponse } from "next/server";
import { requireAuthAndOrg } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import {
  createEnvironmentPair,
  deleteEnvironmentPair,
  getEnvironmentPairsByOrg,
} from "@/lib/db/repositories/governance.repository";
import { db } from "@/lib/db";
import { safes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

export async function GET() {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:read", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pairs = await getEnvironmentPairsByOrg(auth.orgId);
  return NextResponse.json({ pairs });
}

const createSchema = z.object({
  productionSafeId: z.string().uuid(),
  twinSafeId: z.string().uuid(),
  twinNetwork: z.string().min(1),
  purpose: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:manage", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { productionSafeId, twinSafeId, twinNetwork, purpose } = parsed.data;
  if (productionSafeId === twinSafeId) {
    return NextResponse.json({ error: "Production and twin must differ" }, { status: 400 });
  }

  const safeRows = await db
    .select({ id: safes.id })
    .from(safes)
    .where(
      and(
        eq(safes.orgId, auth.orgId),
        eq(safes.id, productionSafeId)
      )
    )
    .limit(1);
  const twinRows = await db
    .select({ id: safes.id, network: safes.network })
    .from(safes)
    .where(and(eq(safes.orgId, auth.orgId), eq(safes.id, twinSafeId)))
    .limit(1);

  if (!safeRows[0] || !twinRows[0]) {
    return NextResponse.json({ error: "Safe not found in org" }, { status: 404 });
  }

  const pair = await createEnvironmentPair({
    orgId: auth.orgId,
    productionSafeId,
    twinSafeId,
    twinNetwork: twinNetwork || twinRows[0].network,
    purpose,
    linkedByUserId: auth.userId,
  });

  return NextResponse.json({ pair }, { status: 201 });
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

  const deleted = await deleteEnvironmentPair(id, auth.orgId);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
