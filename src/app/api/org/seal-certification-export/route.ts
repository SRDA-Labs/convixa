import { NextResponse } from "next/server";
import { requireAuthAndOrg } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import {
  buildCertificationPack,
  packToCsvSections,
} from "@/lib/certification/build-pack";
import { saveCertificationExport } from "@/lib/db/repositories/governance.repository";

export async function GET(req: Request) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  const canExport = await hasPermission("certification:export", auth.orgId);
  const canPreview = await hasPermission("security:read", auth.orgId);

  if (!canPreview) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const format = new URL(req.url).searchParams.get("format") ?? "json";
  const previewOnly = new URL(req.url).searchParams.get("preview") === "true";

  if (!canExport && !previewOnly) {
    return NextResponse.json({ error: "certification:export required" }, { status: 403 });
  }

  const pack = await buildCertificationPack(auth.orgId);

  if (!previewOnly && canExport) {
    await saveCertificationExport({
      orgId: auth.orgId,
      exportedByUserId: auth.userId,
      manifestJson: pack.manifest as unknown as Record<string, unknown>,
    });
  }

  if (format === "csv") {
    return new NextResponse(packToCsvSections(pack), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="seal-certification-summary.csv"',
      },
    });
  }

  if (previewOnly) {
    return NextResponse.json({
      manifest: pack.manifest,
      readinessScore: pack.readinessSummary.overallScore,
      timelockCoveragePct: pack.governanceSummary.timelockCoveragePct,
      criticalPolicyGaps: pack.governanceSummary.criticalPolicyGaps,
      sectionCount: pack.manifest.sectionCount,
    });
  }

  return new NextResponse(JSON.stringify(pack, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="seal-certification-pack.json"',
    },
  });
}
