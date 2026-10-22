import { NextResponse } from "next/server";
import { requireAuthAndOrg } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import { computeOrgGovernance } from "@/lib/governance/compute-governance";
import {
  getOrCreateGovernanceSettings,
  updateGovernanceSettings,
} from "@/lib/db/repositories/governance.repository";
import { z } from "zod";

export async function GET() {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:read", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [metrics, settings] = await Promise.all([
    computeOrgGovernance(auth.orgId),
    getOrCreateGovernanceSettings(auth.orgId),
  ]);

  return NextResponse.json({ metrics, settings });
}

const settingsSchema = z.object({
  minDelaySecondsTreasury: z.number().int().positive().optional(),
  minDelaySecondsProtocol: z.number().int().positive().optional(),
  requireTimelockProtocolCritical: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:manage", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const settings = await updateGovernanceSettings(auth.orgId, parsed.data);
  return NextResponse.json({ settings });
}
