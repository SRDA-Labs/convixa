import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { safes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getDefaultTeams, hasPermission } from "@/lib/auth-server";
import { simulatePendingTx } from "@/lib/tx-simulation/simulate-pending-tx";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; safeTxHash: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, safeTxHash } = await params;
  const [safe] = await db.select().from(safes).where(eq(safes.id, id)).limit(1);
  if (!safe) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const teams = await getDefaultTeams();
  if (!teams.some((t) => t.teamId === safe.teamId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canSim =
    (await hasPermission("signer:workflow", safe.orgId)) ||
    (await hasPermission("security:read", safe.orgId));
  if (!canSim) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { getSimulationCache } = await import(
    "@/lib/db/repositories/governance.repository"
  );
  const cached = await getSimulationCache(id, safeTxHash);
  if (cached?.resultJson) {
    return NextResponse.json({
      cached: true,
      status: cached.status,
      result: cached.resultJson,
    });
  }

  return NextResponse.json({ cached: false, status: null, result: null });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; safeTxHash: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, safeTxHash } = await params;
  const [safe] = await db.select().from(safes).where(eq(safes.id, id)).limit(1);
  if (!safe) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const teams = await getDefaultTeams();
  if (!teams.some((t) => t.teamId === safe.teamId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canSim =
    (await hasPermission("signer:workflow", safe.orgId)) ||
    (await hasPermission("security:read", safe.orgId));
  if (!canSim) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const to = (body as { to?: string }).to;
  const data = (body as { data?: string }).data;
  const value = (body as { value?: string }).value;
  const force = (body as { force?: boolean }).force;

  if (!to) {
    return NextResponse.json({ error: "to address required" }, { status: 400 });
  }

  const result = await simulatePendingTx({
    orgId: safe.orgId,
    safeId: id,
    network: safe.network,
    safeAddress: safe.address,
    safeTxHash,
    to,
    data,
    value,
    force,
  });

  return NextResponse.json(result);
}
