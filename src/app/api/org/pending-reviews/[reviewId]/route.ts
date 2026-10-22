import { NextResponse } from "next/server";
import { requireAuthAndOrg } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import { getReviewDetailById } from "@/lib/db/repositories/operational-workflows.repository";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:read", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { reviewId } = await params;
  const detail = await getReviewDetailById(reviewId, auth.orgId);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
