import { NextResponse } from "next/server";
import { requireAuthSignerWorkflow } from "@/lib/api-helpers";
import { buildSignerQueue } from "@/lib/signer-queue/aggregator";

/**
 * GET /api/signer/queue
 *
 * Returns all pending transactions waiting on the user's linked wallets,
 * grouped by wallet → org → safe.
 */
export async function GET() {
  const auth = await requireAuthSignerWorkflow();
  if (auth instanceof NextResponse) return auth;

  const queue = await buildSignerQueue(auth.userId);

  return NextResponse.json(queue);
}
