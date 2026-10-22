import { NextResponse } from "next/server";
import { requireAuthSignerWorkflow } from "@/lib/api-helpers";
import { getReviewsByUser } from "@/lib/db/repositories/operational-workflows.repository";

/** GET /api/signer/checklist-reviews — current user's review status by safe+tx */
export async function GET() {
  const auth = await requireAuthSignerWorkflow();
  if (auth instanceof NextResponse) return auth;

  const rows = await getReviewsByUser(auth.userId);
  const byKey: Record<string, { status: string }> = {};
  for (const row of rows) {
    byKey[`${row.safeId}:${row.safeTxHash}`] = { status: row.status };
  }

  return NextResponse.json({ reviews: byKey });
}
