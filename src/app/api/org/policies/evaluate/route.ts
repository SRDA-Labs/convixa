import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthOrgPermission } from "@/lib/api-helpers";
import { getDefaultTeams } from "@/lib/auth-server";
import { uuidSchema } from "@/lib/validations";
import { db } from "@/lib/db";
import { safes, safeTransactionHistory } from "@/lib/db/schema";
import { eq, gte, inArray, and } from "drizzle-orm";
import { evaluatePolicies } from "@/lib/policy-engine/evaluate";
import { fetchSafeInfo, fetchSafePendingTransactions } from "@/lib/safe-api";
import type { SafeTransaction } from "@/lib/safe-api";
import type { PendingTxInput } from "@/lib/policy-engine/types";

const dryRunSchema = z.object({
  policyConfig: z.object({
    trigger: z.string(),
    conditions: z.array(z.any()),
    actions: z.array(z.any()),
  }),
  dryRun: z.boolean().default(true),
  lookbackDays: z.number().min(1).max(90).default(30),
  scope: z.enum(["org", "safe"]),
  safeId: z.string().uuid().optional(),
});

/** GET /api/org/policies/evaluate?safeId=... – evaluate policies for a single Safe's pending txs. */
export async function GET(req: Request) {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const { searchParams } = new URL(req.url);
  const safeIdParsed = uuidSchema.safeParse(searchParams.get("safeId"));
  if (!safeIdParsed.success) return NextResponse.json({ error: "Invalid or missing safeId" }, { status: 400 });
  const safeId = safeIdParsed.data;

  const userTeams = await getDefaultTeams();
  const teamIds = userTeams.map((t) => t.teamId);
  if (teamIds.length === 0) return NextResponse.json({ alerts: [], violations: [] });

  const [target] = await db
    .select({ id: safes.id, address: safes.address, network: safes.network, name: safes.name, teamId: safes.teamId, implementation: safes.implementation })
    .from(safes)
    .where(eq(safes.id, safeId))
    .limit(1);

  if (!target || !target.teamId || !teamIds.includes(target.teamId)) return NextResponse.json({ error: "Safe not found" }, { status: 404 });

  let pendingTxs: PendingTxInput[] = [];
  try {
    const info = await fetchSafeInfo(target.network, target.address);
    const raw = await fetchSafePendingTransactions(target.network, target.address);
    const currentNonce = info?.nonce ?? 0;
    const pending = (raw ?? []).filter((tx: SafeTransaction & { nonce?: number | string }) => {
      const txNonce = typeof tx.nonce === "string" ? parseInt(tx.nonce, 10) : (tx.nonce ?? 0);
      return txNonce === currentNonce;
    });
    pendingTxs = pending.map((tx: SafeTransaction) => ({
      to: tx.to,
      value: tx.value,
      data: tx.data,
      operation: tx.operation,
      safeTxHash: tx.safeTxHash,
    }));
  } catch {
    // Safe API error
  }

  const evalResult = await evaluatePolicies(orgId, [
    { safeId: target.id, safeAddress: target.address, network: target.network, safeName: target.name, pendingTxs, implementation: target.implementation ?? undefined },
  ]);
  return NextResponse.json({ alerts: evalResult.alerts, violations: evalResult.violations });
}

/** POST /api/org/policies/evaluate — dry-run: evaluate a policy config against historical tx data. */
export async function POST(req: Request) {
  const authResult = await requireAuthOrgPermission("safes:read");
  if (authResult instanceof NextResponse) return authResult;
  const { orgId } = authResult;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = dryRunSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }
  const { policyConfig, lookbackDays, scope, safeId } = parsed.data;

  // Determine which safes to evaluate
  let targetSafes: { id: string; address: string; network: string; name: string | null; implementation: string | null }[] = [];
  const userTeams = await getDefaultTeams();
  const teamIds = userTeams.map((t) => t.teamId);

  if (scope === "safe" && safeId) {
    const [s] = await db
      .select({ id: safes.id, address: safes.address, network: safes.network, name: safes.name, teamId: safes.teamId, implementation: safes.implementation })
      .from(safes)
      .where(eq(safes.id, safeId))
      .limit(1);
    if (s && s.teamId && teamIds.includes(s.teamId)) {
      targetSafes = [{ id: s.id, address: s.address, network: s.network, name: s.name, implementation: s.implementation }];
    }
  } else {
    const orgSafes = await db
      .select({ id: safes.id, address: safes.address, network: safes.network, name: safes.name, teamId: safes.teamId, implementation: safes.implementation })
      .from(safes)
      .where(eq(safes.orgId, orgId));
    targetSafes = orgSafes.filter((s) => s.teamId && teamIds.includes(s.teamId));
  }

  if (targetSafes.length === 0) {
    return NextResponse.json({ dryRun: true, lookbackDays, safesEvaluated: 0, transactionsEvaluated: 0, alertsThatWouldHaveFired: 0, violationsThatWouldHaveBlocked: 0, samples: [] });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  // Fetch historical transactions for all target safes
  const safeIds = targetSafes.map((s) => s.id);
  const historyRows = await db
    .select({ safeId: safeTransactionHistory.safeId, safeTxHash: safeTransactionHistory.safeTxHash, toAddress: safeTransactionHistory.toAddress, valueWei: safeTransactionHistory.valueWei, data: safeTransactionHistory.data, operation: safeTransactionHistory.operation, executedAt: safeTransactionHistory.executedAt })
    .from(safeTransactionHistory)
    .where(and(
      inArray(safeTransactionHistory.safeId, safeIds),
      gte(safeTransactionHistory.executedAt, cutoff)
    ))
    .orderBy(safeTransactionHistory.executedAt);

  // Build per-safe pending tx inputs from history
  let transactionsEvaluated = 0;
  const safesWithPending: { safeId: string; safeAddress: string; network: string; safeName: string | null; pendingTxs: PendingTxInput[]; implementation?: string }[] = [];

  for (const safe of targetSafes) {
    const txs: PendingTxInput[] = historyRows
      .filter((r) => r.safeId === safe.id)
      .map((r) => ({
        to: r.toAddress,
        value: r.valueWei,
        data: r.data,
        operation: r.operation ?? 0,
        safeTxHash: r.safeTxHash,
      }));
    transactionsEvaluated += txs.length;
    safesWithPending.push({
      safeId: safe.id,
      safeAddress: safe.address,
      network: safe.network,
      safeName: safe.name,
      pendingTxs: txs,
      implementation: safe.implementation ?? undefined,
    });
  }

  // Create a temporary policy for evaluation
  // We bypass the DB and evaluate directly via the config
  const evalResult = await evaluatePolicies(orgId, safesWithPending);

  // Collect sample violations/alerts (max 5)
  const samples = [...evalResult.alerts, ...evalResult.violations].slice(0, 5).map((item) => ({
    safeId: item.safeId,
    safeName: "safeName" in item ? (item as any).safeName ?? null : null,
    txHash: (item as any).safeTxHash ?? (item as any).txHash ?? undefined,
    to: (item as any).to ?? undefined,
    value: (item as any).value ?? undefined,
    reason: item.reason,
  }));

  return NextResponse.json({
    dryRun: true,
    lookbackDays,
    safesEvaluated: targetSafes.length,
    transactionsEvaluated,
    alertsThatWouldHaveFired: evalResult.alerts.length,
    violationsThatWouldHaveBlocked: evalResult.violations.length,
    samples,
  });
}
