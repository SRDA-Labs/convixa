import { NextResponse } from "next/server";
import { requireAuthAndOrg } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import { getReviewsByOrg } from "@/lib/db/repositories/operational-workflows.repository";

export async function GET(req: Request) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:read", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const format = new URL(req.url).searchParams.get("format") ?? "json";
  const rows = await getReviewsByOrg(auth.orgId);

  const payload = rows.map((r) => ({
    safeName: r.safeName,
    safeAddress: r.safeAddress,
    network: r.network,
    classification: r.classification,
    safeTxHash: r.review.safeTxHash,
    status: r.review.status,
    signingNote: r.review.signingNote,
    updatedAt: r.review.updatedAt,
  }));

  if (format === "csv") {
    const headers = [
      "safe_name",
      "safe_address",
      "network",
      "classification",
      "safe_tx_hash",
      "status",
      "signing_note",
      "updated_at",
    ];
    const lines = [
      headers.join(","),
      ...payload.map((r) =>
        [
          r.safeName ?? "",
          r.safeAddress,
          r.network,
          r.classification ?? "",
          r.safeTxHash,
          r.status,
          r.signingNote ?? "",
          r.updatedAt,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="pending-reviews-export.csv"',
      },
    });
  }

  return NextResponse.json({ exportedAt: new Date().toISOString(), reviews: payload });
}
