import { NextResponse } from "next/server";
import { requireAuth, validateSafeAccess } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import { getProviderFor } from "@/lib/multisig-provider";
import type { MultisigImplementation } from "@/lib/multisig-provider";
import { writeSafeSnapshot } from "@/lib/safe-config/snapshot-write";
import { backfillConfigEventsFromHistory } from "@/lib/safe-config/history";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });
  }
  const safeId = parsed.data;

  const safeResult = await validateSafeAccess(safeId);
  if (safeResult instanceof NextResponse) return safeResult;
  const { safe } = safeResult;

  const provider = getProviderFor(
    safe.implementation as MultisigImplementation,
    safe.network
  );

  const account = await provider.fetchAccount(safe.network, safe.address);
  if (!account) {
    return NextResponse.json(
      { error: "Safe not found or not indexed yet. Check network and address." },
      { status: 502 }
    );
  }

  const pending = await provider.fetchPendingTransactions(
    safe.network,
    safe.address
  );
  const pendingCount = pending.filter((tx) => tx.nonce === account.nonce).length;

  let lastTxAt: Date | null = null;
  try {
    const history = await provider.fetchTransactionHistory(
      safe.network,
      safe.address,
      1
    );
    const latest = history[0];
    if (latest?.submissionDate) lastTxAt = new Date(latest.submissionDate);
  } catch {
    // non-critical
  }

  const refreshedAt = await writeSafeSnapshot({
    safeId,
    orgId: safe.orgId,
    network: safe.network,
    address: safe.address,
    threshold: account.threshold,
    owners: account.signers,
    nonce: account.nonce,
    pendingCount,
    lastTxAt,
    implementationVersion: account.version ?? null,
    rawResponse: { account, pendingCount, lastTxAt },
  });

  backfillConfigEventsFromHistory(safeId, 50).catch(() => {});

  return NextResponse.json({ ok: true, refreshedAt: refreshedAt.toISOString() });
}
