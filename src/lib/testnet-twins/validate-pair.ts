export type TwinDriftStatus = {
  inSync: boolean;
  productionThreshold: number | null;
  twinThreshold: number | null;
  productionOwners: number;
  twinOwners: number;
  issues: string[];
};

export function compareTwinSnapshots(
  production: { threshold: number | null; owners: unknown },
  twin: { threshold: number | null; owners: unknown }
): TwinDriftStatus {
  const prodOwners = Array.isArray(production.owners) ? production.owners.length : 0;
  const twinOwners = Array.isArray(twin.owners) ? twin.owners.length : 0;
  const issues: string[] = [];

  if (production.threshold != null && twin.threshold != null && production.threshold !== twin.threshold) {
    issues.push(`Threshold mismatch: ${production.threshold} vs ${twin.threshold}`);
  }
  if (prodOwners !== twinOwners) {
    issues.push(`Owner count mismatch: ${prodOwners} vs ${twinOwners}`);
  }

  return {
    inSync: issues.length === 0,
    productionThreshold: production.threshold,
    twinThreshold: twin.threshold,
    productionOwners: prodOwners,
    twinOwners,
    issues,
  };
}
