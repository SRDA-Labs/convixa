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

  const status = new URL(req.url).searchParams.get("status");
  const statusFilter = status ? status.split(",") : undefined;

  const cases = await getOobCasesByOrg(auth.orgId, statusFilter);
  return NextResponse.json({ cases });
}
