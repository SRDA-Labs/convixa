export const DRILL_TYPES = [
  "tabletop",
  "testnet_sign",
  "key_compromise_sim",
  "pause_walkthrough",
  "communications_failover",
] as const;

export type DrillType = (typeof DRILL_TYPES)[number];

export const DRILL_TYPE_LABELS: Record<DrillType, string> = {
  tabletop: "Tabletop exercise",
  testnet_sign: "Testnet signing drill",
  key_compromise_sim: "Key compromise simulation",
  pause_walkthrough: "Emergency pause walkthrough",
  communications_failover: "Communications failover",
};

export const DRILL_CADENCES = [
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
  "ad_hoc",
] as const;

export type DrillCadence = (typeof DRILL_CADENCES)[number];

export const DRILL_CADENCE_LABELS: Record<DrillCadence, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-annual",
  annual: "Annual",
  ad_hoc: "Ad hoc",
};

export const DRILL_RUN_STATUSES = [
  "scheduled",
  "completed",
  "missed",
  "cancelled",
] as const;

export type DrillRunStatus = (typeof DRILL_RUN_STATUSES)[number];

export function cadenceToDays(cadence: DrillCadence): number {
  switch (cadence) {
    case "monthly":
      return 30;
    case "quarterly":
      return 90;
    case "semi_annual":
      return 182;
    case "annual":
      return 365;
    default:
      return 90;
  }
}

export function computeNextDueAt(
  cadence: DrillCadence,
  from: Date = new Date()
): Date {
  const days = cadenceToDays(cadence);
  return new Date(from.getTime() + days * 86400000);
}
