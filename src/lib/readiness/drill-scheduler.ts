import type { DrillCadence } from "./drill-types";
import { cadenceToDays, computeNextDueAt } from "./drill-types";
import { getDrillGraceDays } from "./config";

export function isDrillOverdue(
  nextDueAt: Date | string | null,
  now: Date = new Date()
): boolean {
  if (!nextDueAt) return false;
  const due = typeof nextDueAt === "string" ? new Date(nextDueAt) : nextDueAt;
  const graceMs = getDrillGraceDays() * 86400000;
  return now.getTime() > due.getTime() + graceMs;
}

export function isDrillDueSoon(
  nextDueAt: Date | string | null,
  withinDays = 30,
  now: Date = new Date()
): boolean {
  if (!nextDueAt) return false;
  const due = typeof nextDueAt === "string" ? new Date(nextDueAt) : nextDueAt;
  const windowEnd = now.getTime() + withinDays * 86400000;
  return due.getTime() >= now.getTime() && due.getTime() <= windowEnd;
}

export function nextDueAfterCompletion(
  cadence: DrillCadence,
  completedAt: Date = new Date()
): Date {
  return computeNextDueAt(cadence, completedAt);
}

export function daysUntilDue(nextDueAt: Date | string | null, now: Date = new Date()): number | null {
  if (!nextDueAt) return null;
  const due = typeof nextDueAt === "string" ? new Date(nextDueAt) : nextDueAt;
  return Math.ceil((due.getTime() - now.getTime()) / 86400000);
}

export function cadenceLabel(cadence: string): string {
  return cadence.replace(/_/g, " ");
}

export function defaultScheduleTitle(drillType: string, safeName?: string | null): string {
  const type = drillType.replace(/_/g, " ");
  if (safeName) return `${type} — ${safeName}`;
  return `Org-wide ${type}`;
}

export function seedCadenceDays(cadence: DrillCadence): number {
  return cadenceToDays(cadence);
}
