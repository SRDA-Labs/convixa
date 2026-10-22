import { NextResponse } from "next/server";
import { requireAuthOrgPermission } from "@/lib/api-helpers";
import { getPolicyFireLogsByOrg } from "@/lib/db/repositories/policy-fire-log.repository";

/**
 * GET /api/org/policies/enforcement-logs
 * Returns recent policy enforcement events for the org.
 * Query params: limit, triggerType, actionType, policyId
 */
export async function GET(req: Request) {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const triggerType = searchParams.get("triggerType") ?? undefined;
  const actionType = searchParams.get("actionType") ?? undefined;
  const policyId = searchParams.get("policyId") ?? undefined;

  const logs = await getPolicyFireLogsByOrg(orgId, {
    limit,
    triggerType,
    actionType,
    policyId,
  });

  return NextResponse.json({
    enforcementLogs: logs.map((log) => ({
      id: log.id,
      policyId: log.policyId,
      policyName: log.policyName,
      safeId: log.safeId,
      safeAddress: log.safeAddress,
      safeName: log.safeName,
      safeTxHash: log.safeTxHash,
      triggerType: log.triggerType,
      actionType: log.actionType,
      actionDetails: log.actionDetails,
      notificationSent: log.notificationSent,
      firedAt: log.firedAt,
    })),
  });
}
