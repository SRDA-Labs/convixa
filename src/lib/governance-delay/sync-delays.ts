import { detectDelaysFromSnapshot } from "./classify-delays";
import { upsertDelayAttachments } from "@/lib/db/repositories/governance.repository";

export async function syncDelaysFromSnapshot(params: {
  orgId: string;
  safeId: string;
  modulesJson: unknown;
  guardAddress?: string | null;
}): Promise<number> {
  const modules = Array.isArray(params.modulesJson)
    ? (params.modulesJson as Array<{ address: string; name?: string | null }>)
    : [];

  const detected = detectDelaysFromSnapshot({
    modules,
    guardAddress: params.guardAddress,
  });

  await upsertDelayAttachments(
    params.orgId,
    params.safeId,
    detected.map((d) => ({
      attachmentType: d.attachmentType,
      moduleAddress: d.moduleAddress,
      delaySeconds: d.delaySeconds,
      metadataJson: d.metadataJson,
    }))
  );

  return detected.length;
}
