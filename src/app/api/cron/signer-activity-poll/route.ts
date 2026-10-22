/**
 * Cron endpoint: poll EOA activity for org roster addresses.
 * Secure with CRON_SECRET: Authorization: Bearer <CRON_SECRET>
 */

import { NextResponse } from "next/server";
import { isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { orgs } from "@/lib/db/schema";
import {
  getDistinctRosterAddressesForOrg,
} from "@/lib/db/repositories/safe-signer-roster.repository";
import { pollOrgEoaActivity, isExplorerSupported } from "@/lib/signer-roster/eoa-activity";

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

  if (!process.env.ETHERSCAN_API_KEY) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "ETHERSCAN_API_KEY not set",
    });
  }

  const orgList = await db
    .select({ id: orgs.id })
    .from(orgs)
    .where(isNull(orgs.deletedAt));

  let totalChecked = 0;
  const errors: string[] = [];

  for (const org of orgList) {
    const addresses = await getDistinctRosterAddressesForOrg(org.id);
    const supported = addresses.filter((a) => isExplorerSupported(a.network));
    if (supported.length === 0) continue;

    const result = await pollOrgEoaActivity(org.id, supported);
    totalChecked += result.checked;
    errors.push(...result.errors);
  }

  return NextResponse.json({
    ok: true,
    checked: totalChecked,
    errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
