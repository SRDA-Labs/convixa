import { NextResponse } from "next/server";
import { requireAuthAndOrg } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import { computeOrgReadiness } from "@/lib/readiness/compute-readiness";
import {
  getOnboardingProgressByOrg,
  getDrillRunsByOrg,
  getPlaybooksByOrg,
} from "@/lib/db/repositories/readiness.repository";

export async function GET(req: Request) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:read", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const format = new URL(req.url).searchParams.get("format") ?? "json";
  const [metrics, onboarding, drills, playbooks] = await Promise.all([
    computeOrgReadiness(auth.orgId),
    getOnboardingProgressByOrg(auth.orgId),
    getDrillRunsByOrg(auth.orgId, 200),
    getPlaybooksByOrg(auth.orgId),
  ]);

  if (format === "csv") {
    const lines = [
      "section,key,value",
      `summary,overall_score,${metrics.overallScore}`,
      `summary,onboarding_pct,${metrics.onboarding.completionPct}`,
      `summary,verification_pct,${metrics.verification.verificationPct}`,
      `summary,overdue_drills,${metrics.drills.overdueCount}`,
      `summary,open_oob_cases,${metrics.operational.openOobCases}`,
      ...onboarding.map(
        (o) =>
          `onboarding,${o.safeName ?? o.safeAddress},${o.roster.signerAddress},${o.progress.status}`
      ),
      ...drills.map(
        (d) =>
          `drill,${d.run.title},${d.run.drillType},${d.run.status},${d.run.completedAt ?? ""}`
      ),
      ...playbooks.map(
        (p) => `playbook,${p.scenario},${p.title},v${p.version},${p.publishedAt ?? ""}`
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="readiness-export.csv"',
      },
    });
  }

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    metrics,
    onboarding: onboarding.map((o) => ({
      safeName: o.safeName,
      signerAddress: o.roster.signerAddress,
      status: o.progress.status,
    })),
    drills: drills.map((d) => d.run),
    playbooks,
  });
}
