import { classifyModuleForDelay } from "./module-registry";

export type DelayDetectionInput = {
  modules: Array<{ address: string; name?: string | null }>;
  guardAddress?: string | null;
};

export type DetectedDelay = {
  attachmentType: string;
  moduleAddress: string;
  delaySeconds: number | null;
  metadataJson: Record<string, unknown>;
};

export function detectDelaysFromSnapshot(input: DelayDetectionInput): DetectedDelay[] {
  const results: DetectedDelay[] = [];
  const seen = new Set<string>();

  for (const mod of input.modules) {
    const classified = classifyModuleForDelay(mod);
    if (!classified) continue;
    const key = mod.address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      attachmentType: classified.type,
      moduleAddress: mod.address,
      delaySeconds: classified.delaySeconds,
      metadataJson: { moduleName: classified.label },
    });
  }

  return results;
}
