import { NextResponse } from "next/server";
import { requireAuthAndOrg } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import { getOobCasesByOrg } from "@/lib/db/repositories/operational-workflows.repository";

export async function GET(req: Request) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:read", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const format = new URL(req.url).searchParams.get("format") ?? "json";
  const rows = await getOobCasesByOrg(auth.orgId);

  const payload = rows.map((r) => ({
    safeName: r.safeName,
    safeAddress: r.safeAddress,
    network: r.network,
    caseId: r.oobCase.id,
    caseType: r.oobCase.caseType,
    status: r.oobCase.status,
    title: r.oobCase.title,
    safeTxHash: r.oobCase.safeTxHash,
    dueAt: r.oobCase.dueAt,
    verifiedAt: r.oobCase.verifiedAt,
    createdAt: r.oobCase.createdAt,
  }));

  if (format === "csv") {
    const headers = [
      "safe_name",
      "safe_address",
      "network",
      "case_id",
      "case_type",
      "status",
      "title",
      "safe_tx_hash",
      "due_at",
      "verified_at",
      "created_at",
    ];
    const lines = [
      headers.join(","),
      ...payload.map((r) =>
        [
          r.safeName ?? "",
          r.safeAddress,
          r.network,
          r.caseId,
          r.caseType,
          r.status,
          r.title,
          r.safeTxHash ?? "",
          r.dueAt ?? "",
          r.verifiedAt ?? "",
          r.createdAt,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="oob-cases-export.csv"',
      },
    });
  }

  return NextResponse.json({ exportedAt: new Date().toISOString(), cases: payload });
}
