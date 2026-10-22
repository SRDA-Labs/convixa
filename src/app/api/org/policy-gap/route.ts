import { NextResponse } from "next/server";
import { requireAuthAndOrg } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import { buildOrgPolicyGapReport } from "@/lib/policy-gap/build-report";

export async function GET(req: Request) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:read", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const format = new URL(req.url).searchParams.get("format");
  const report = await buildOrgPolicyGapReport(auth.orgId);

  if (format === "csv") {
    const lines = [
      "safe_address,safe_name,gap_id,severity,category,message,remediation",
      ...report.gaps.map(
        (g) =>
          `"${g.safeAddress}","${g.safeName ?? ""}","${g.id}","${g.severity}","${g.category}","${g.message}","${g.remediation}"`
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="policy-gap-report.csv"',
      },
    });
  }

  return NextResponse.json(report);
}
