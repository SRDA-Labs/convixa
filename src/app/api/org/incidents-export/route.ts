import { NextResponse } from "next/server";
import { requireAuthAndOrg } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import { getSecurityIncidentsByOrg } from "@/lib/db/repositories/operational-workflows.repository";

export async function GET(req: Request) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:read", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const format = new URL(req.url).searchParams.get("format") ?? "json";
  const incidents = await getSecurityIncidentsByOrg(auth.orgId);

  const payload = incidents.map((i) => ({
    id: i.id,
    incidentType: i.incidentType,
    severity: i.severity,
    status: i.status,
    title: i.title,
    createdAt: i.createdAt,
    resolvedAt: i.resolvedAt,
  }));

  if (format === "csv") {
    const headers = ["id", "incident_type", "severity", "status", "title", "created_at", "resolved_at"];
    const lines = [
      headers.join(","),
      ...payload.map((r) =>
        [r.id, r.incidentType, r.severity, r.status, r.title, r.createdAt, r.resolvedAt ?? ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="incidents-export.csv"',
      },
    });
  }

  return NextResponse.json({ exportedAt: new Date().toISOString(), incidents: payload });
}
