import { NextResponse } from "next/server";
import { requireAuthAndOrg } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import { computeOrgReadiness } from "@/lib/readiness/compute-readiness";
import {
  getReadinessSnapshots,
  saveReadinessSnapshot,
} from "@/lib/db/repositories/readiness.repository";
import { isReadinessSnapshotEnabled } from "@/lib/readiness/config";

export async function GET() {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:read", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const metrics = await computeOrgReadiness(auth.orgId);
  const snapshots = await getReadinessSnapshots(auth.orgId, 12);

  return NextResponse.json({ metrics, snapshots });
}

export async function POST() {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:read", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const metrics = await computeOrgReadiness(auth.orgId);
  let snapshot = null;
  if (isReadinessSnapshotEnabled()) {
    snapshot = await saveReadinessSnapshot(auth.orgId, metrics as unknown as Record<string, unknown>);
  }

  return NextResponse.json({ metrics, snapshot });
}
