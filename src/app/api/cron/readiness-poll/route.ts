/**
 * Cron endpoint: readiness snapshots + drill overdue marking.
 * Secure with CRON_SECRET: Authorization: Bearer <CRON_SECRET>
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orgs } from "@/lib/db/schema";
import { computeOrgReadiness } from "@/lib/readiness/compute-readiness";
import {
  saveReadinessSnapshot,
  countOverdueDrillSchedules,
  countIncompleteOnboardingPastSla,
} from "@/lib/db/repositories/readiness.repository";
import { isReadinessSnapshotEnabled } from "@/lib/readiness/config";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function getCronSecret(): string | null {
  return process.env.CRON_SECRET ?? process.env.ALERT_CRON_SECRET ?? null;
}

function isAuthorized(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  return auth.slice(7) === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const allOrgs = await db.select({ id: orgs.id }).from(orgs);
    const results: Array<{
      orgId: string;
      overdueDrills: number;
      incompleteOnboarding: number;
      snapshotted: boolean;
    }> = [];

    for (const org of allOrgs) {
      const metrics = await computeOrgReadiness(org.id);
      let snapshotted = false;
      if (isReadinessSnapshotEnabled()) {
        await saveReadinessSnapshot(org.id, metrics as unknown as Record<string, unknown>);
        snapshotted = true;
      }
      const [overdueDrills, incompleteOnboarding] = await Promise.all([
        countOverdueDrillSchedules(org.id),
        countIncompleteOnboardingPastSla(org.id),
      ]);
      results.push({
        orgId: org.id,
        overdueDrills,
        incompleteOnboarding,
        snapshotted,
      });
    }

    return NextResponse.json({ ok: true, orgs: results.length, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[cron/readiness-poll]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
