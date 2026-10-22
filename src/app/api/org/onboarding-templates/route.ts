import { NextResponse } from "next/server";
import { requireAuthAndOrg } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import { getOnboardingTemplatesByOrg } from "@/lib/db/repositories/readiness.repository";

export async function GET() {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:read", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates = await getOnboardingTemplatesByOrg(auth.orgId);
  return NextResponse.json({ templates });
}
