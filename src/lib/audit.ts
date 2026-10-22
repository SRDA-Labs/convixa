import { createAuditLog } from "@/lib/db/repositories";

export async function logAudit(params: {
  orgId: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
}) {
  await createAuditLog({
    orgId: params.orgId,
    userId: params.userId ?? null,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId ?? null,
    metadata: params.metadata ?? null,
    ip: params.ip ?? null,
  });
}
