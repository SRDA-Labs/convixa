import { NextResponse } from "next/server";
import { requireAuth, requireOrg } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import { getRostersForExport } from "@/lib/db/repositories/safe-signer-roster.repository";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const org = await requireOrg();
  if (org instanceof NextResponse) return org;

  if (!(await hasPermission("security:read", org.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const format = new URL(req.url).searchParams.get("format") ?? "json";
  const rows = await getRostersForExport(org.orgId);

  const payload = rows.map((r) => ({
    safeId: r.safeId,
    safeName: r.safeName,
    safeAddress: r.safeAddress,
    network: r.network,
    classification: r.classification,
    signerAddress: r.signerAddress,
    displayName: r.displayName,
    signerType: r.signerType,
    roleLabel: r.roleLabel,
    hardwareWallet: r.hardwareWallet,
    verificationStatus: r.verificationStatus,
    verificationMethod: r.verificationMethod,
  }));

  if (format === "csv") {
    const headers = [
      "safe_name",
      "safe_address",
      "network",
      "classification",
      "signer_address",
      "display_name",
      "signer_type",
      "role_label",
      "hardware_wallet",
      "verification_status",
      "verification_method",
    ];
    const lines = [
      headers.join(","),
      ...payload.map((r) =>
        [
          r.safeName ?? "",
          r.safeAddress,
          r.network,
          r.classification ?? "",
          r.signerAddress,
          r.displayName ?? "",
          r.signerType,
          r.roleLabel ?? "",
          r.hardwareWallet ?? "",
          r.verificationStatus,
          r.verificationMethod ?? "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="signer-roster-export.csv"',
      },
    });
  }

  return NextResponse.json({ exportedAt: new Date().toISOString(), roster: payload });
}
