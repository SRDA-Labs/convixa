import { NextResponse } from "next/server";
import { z } from "zod";
import { getDefaultOrgId, getDefaultTeams, canManageTeam } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { getProviderFor } from "@/lib/multisig-provider";
import type { MultisigImplementation } from "@/lib/multisig-provider";
import { requireAuth, parseRequestBody, requireActiveOrg } from "@/lib/api-helpers";
import {
  createSafe,
  getSafesByTeams,
} from "@/lib/db/repositories";
import { writeSafeSnapshot } from "@/lib/safe-config/snapshot-write";

const postSchema = z.object({
  teamId: z.string().uuid(),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  network: z.string().min(1),
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  implementation: z
    .enum(["safe", "zodiac", "roles_v2", "hats_signer_gate", "custom"])
    .default("safe"),
});

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const orgId = await getDefaultOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "No org" }, { status: 400 });
  }

  const userTeams = await getDefaultTeams();
  const teamIds = userTeams.map((t) => t.teamId);

  if (teamIds.length === 0) {
    return NextResponse.json({ safes: [] });
  }

  // Use repository to get safes with snapshots
  const list = await getSafesByTeams(teamIds);

  // Dedupe: keep latest snapshot per safe
  const bySafe = new Map<string, (typeof list)[0]>();
  const sorted = [...list].sort((a, b) => {
    const aT = a.refreshedAt ? new Date(a.refreshedAt).getTime() : 0;
    const bT = b.refreshedAt ? new Date(b.refreshedAt).getTime() : 0;
    return bT - aT;
  });
  for (const row of sorted) {
    if (!bySafe.has(row.id)) bySafe.set(row.id, row);
  }
  const safesList = Array.from(bySafe.values());

  return NextResponse.json({ safes: safesList });
}

export async function POST(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const orgResult = await requireActiveOrg();
  if (orgResult instanceof NextResponse) return orgResult;
  const { orgId } = orgResult;

  const parseResult = await parseRequestBody(req, postSchema);
  if ("error" in parseResult) return parseResult.error;
  const parsed = parseResult.data;

  const [team] = await db
    .select({ orgId: teams.orgId })
    .from(teams)
    .where(eq(teams.id, parsed.teamId))
    .limit(1);

  if (!team || team.orgId !== orgId) {
    return NextResponse.json({ error: "Team not found in this organization" }, { status: 404 });
  }

  if (!(await canManageTeam(parsed.teamId))) {
    return NextResponse.json({ error: "Not allowed to add Safe to this team" }, { status: 403 });
  }

  // Create safe using repository
  const safe = await createSafe({
    orgId,
    teamId: parsed.teamId,
    address: parsed.address,
    network: parsed.network,
    name: parsed.name,
    tags: parsed.tags,
    notes: parsed.notes,
    implementation: parsed.implementation,
  });

  if (!safe) {
    return NextResponse.json({ error: "Failed to create Safe" }, { status: 500 });
  }

  await logAudit({
    orgId,
    userId,
    action: "safe.create",
    resourceType: "safe",
    resourceId: safe.id,
    metadata: { address: safe.address, network: safe.network, teamId: parsed.teamId },
  });

  // Optional: trigger initial data fetch via provider to populate snapshot
  try {
    const provider = getProviderFor(parsed.implementation as MultisigImplementation, parsed.network);
    const [account, pending] = await Promise.all([
      provider.fetchAccount(parsed.network, parsed.address),
      provider.fetchPendingTransactions(parsed.network, parsed.address),
    ]);
    if (account) {
      const pendingCount = pending.filter((tx) => tx.nonce === account.nonce).length;
      await writeSafeSnapshot({
        safeId: safe.id,
        orgId,
        network: parsed.network,
        address: parsed.address,
        threshold: account.threshold,
        owners: account.signers,
        nonce: account.nonce,
        pendingCount,
        lastTxAt: pending[0]?.submissionDate ? new Date(pending[0].submissionDate) : null,
        implementationVersion: account.version ?? null,
        rawResponse: { account, pendingCount },
      });
    }
  } catch {
    // ignore; snapshot can be refreshed later
  }

  return NextResponse.json({ safe });
}
