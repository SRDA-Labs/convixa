export function getDrillGraceDays(): number {
  const raw = process.env.READINESS_DRILL_GRACE_DAYS;
  const n = raw ? parseInt(raw, 10) : 7;
  return Number.isFinite(n) && n >= 0 ? n : 7;
}

export function getOnboardingSlaDays(): number {
  const raw = process.env.READINESS_ONBOARDING_SLA_DAYS;
  const n = raw ? parseInt(raw, 10) : 30;
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export function isReadinessSnapshotEnabled(): boolean {
  return process.env.READINESS_SNAPSHOT_ENABLED !== "false";
}
