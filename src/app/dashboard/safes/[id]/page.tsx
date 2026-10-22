import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { getAddress } from "viem";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { safes, safeSnapshots, teams } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getDefaultTeams, canManageTeam } from "@/lib/auth-server";
import { evaluateComplianceFromSnapshot, rosterRowsToComplianceEntries } from "@/lib/seal-compliance/evaluate";
import { ComplianceScorecard } from "./compliance-scorecard";
import { ConfigChangeTimeline } from "./config-change-timeline";
import { SafeProfileForm } from "./safe-profile-form";
import { SecurityAttachments } from "./security-attachments";
import { SignerRosterTable } from "./signer-roster-table";
import { VerifyAffiliationBanner } from "./verify-affiliation-banner";
import { getRosterBySafeId } from "@/lib/db/repositories/safe-signer-roster.repository";
import { getOperationalComplianceSlice } from "@/lib/operational-workflows/metrics";
import { getReadinessComplianceSlice } from "@/lib/readiness/compliance-slice";
import { getGovernanceComplianceSlice } from "@/lib/governance/compliance-slice";
import { buildSafePolicyGapReport } from "@/lib/policy-gap/build-report";
import { users, signerWalletLinks } from "@/lib/db/schema";
import { getSafeAppUrl, getSafeTxServiceBaseUrl, inferTxType, safeApiFetch } from "@/lib/safe-api";
import { RefreshButton } from "./refresh-button";
import { SafeBalance } from "./safe-balance";
import { SafeTransactions } from "./safe-transactions";
import type { SafeTxItem } from "./safe-transactions";
import { SafePendingTransactions } from "./safe-pending-transactions";
import type { PendingTxItem } from "./safe-pending-transactions";
function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return d.toLocaleString("en-US", { month: "short", day: "numeric" });
}

function formatBalance(balance: string, decimals: number, symbol: string): string {
  try {
    const n = BigInt(balance);
    if (n === BigInt(0)) return `0 ${symbol}`;
    const divisor = 10 ** decimals;
    const whole = n / BigInt(divisor);
    const frac = n % BigInt(divisor);
    const fracStr = frac.toString().padStart(decimals, "0").slice(0, decimals).replace(/0+$/, "") || "0";
    const fracTrim = fracStr.slice(0, 4);
    if (whole > BigInt(0)) return `${whole}${fracTrim !== "0" ? "." + fracTrim : ""} ${symbol}`;
    return `< 0.001 ${symbol}`;
  } catch { return `— ${symbol}`; }
}

export const dynamic = "force-dynamic";

export default async function SafeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const { id } = await params;
  const userTeams = await getDefaultTeams();
  const teamIds = userTeams.map((t) => t.teamId);

  const [safe] = await db.select().from(safes).where(eq(safes.id, id)).limit(1);
  if (!safe || !teamIds.includes(safe.teamId)) notFound();

  const [snapshot] = await db
    .select().from(safeSnapshots).where(eq(safeSnapshots.safeId, id))
    .orderBy(desc(safeSnapshots.refreshedAt)).limit(1);

  const [team] = await db.select().from(teams).where(eq(teams.id, safe.teamId)).limit(1);
  const safeAppUrl = getSafeAppUrl(safe.network, safe.address);
  const canEdit = await canManageTeam(safe.teamId);

  let pendingCountDisplay: number | null = null;
  let initialPendingTransactions: PendingTxItem[] = [];
  try {
    const safeAddress = getAddress(safe.address);
    const base = getSafeTxServiceBaseUrl(safe.network);
    const pendingRes = await safeApiFetch(`${base}api/v1/safes/${safeAddress}/multisig-transactions/?executed=false`);
    if (pendingRes.ok) {
      type PendingRow = { nonce?: number | string; safeTxHash?: string; to?: string; value?: string; data?: string | null; submissionDate?: string; dataDecoded?: { method?: string } | null };
      const pendingData = (await pendingRes.json()) as { results?: PendingRow[] };
      const list = pendingData.results ?? [];
      pendingCountDisplay = list.length;
      initialPendingTransactions = list.map((t) => {
        const value = t.value ?? "0";
        const txType = inferTxType(t.dataDecoded?.method, value, t.data ?? "");
        return { safeTxHash: t.safeTxHash ?? "", to: t.to ?? "", value, submissionDate: t.submissionDate ?? "", txType };
      });
    }
  } catch { /* use snapshot */ }

  const ownersList: string[] = snapshot?.owners != null
    ? typeof snapshot.owners === "string"
      ? (() => { try { return JSON.parse(snapshot.owners); } catch { return []; } })()
      : Array.isArray(snapshot.owners) ? snapshot.owners : []
    : [];

  type BalanceEntry = { tokenAddress?: string | null; token?: { symbol?: string; decimals?: number } | null; balance?: string };
  type BalanceItem = { symbol: string; balance: string; decimals: number };
  let balanceItems: BalanceItem[] = [];
  try {
    const safeAddress = getAddress(safe.address);
    const base = getSafeTxServiceBaseUrl(safe.network);
    const balRes = await safeApiFetch(`${base}api/v1/safes/${safeAddress}/balances/?trusted=false`);
    if (balRes.ok) {
      const raw = await balRes.json();
      const results: BalanceEntry[] = Array.isArray(raw) ? raw : (raw?.results ?? raw?.items ?? []);
      balanceItems = results.map((r) => {
        const decimals = r.token?.decimals ?? 18;
        const symbol = r.token?.symbol ?? ((!r.tokenAddress || r.tokenAddress === "0x0000000000000000000000000000000000000000") ? "ETH" : "Token");
        return { symbol, balance: r.balance ?? "0", decimals };
      });
    }
  } catch { /* leave empty */ }

  const modulesList = Array.isArray(snapshot?.modulesJson)
    ? (snapshot.modulesJson as { address: string; name?: string }[])
    : [];

  const rosterRows = await getRosterBySafeId(id);
  const rosterForCompliance = rosterRowsToComplianceEntries(rosterRows);

  const [operational, readiness, governance, policyGaps] = await Promise.all([
    getOperationalComplianceSlice(
      safe.orgId,
      id,
      safe.classification ?? null,
      safe.address,
      safe.network
    ),
    getReadinessComplianceSlice(safe.orgId, id),
    getGovernanceComplianceSlice(safe.orgId, id),
    buildSafePolicyGapReport(safe.orgId, id),
  ]);

  const compliance = evaluateComplianceFromSnapshot({
    threshold: snapshot?.threshold ?? null,
    owners: ownersList,
    classification: safe.classification ?? null,
    purpose: safe.purpose ?? null,
    moduleExceptionNote: safe.moduleExceptionNote ?? null,
    modulesJson: snapshot?.modulesJson ?? null,
    balances: snapshot?.balances ?? balanceItems,
    roster: rosterForCompliance,
    operational,
    readiness,
    governance,
    policyGaps,
  });

  const userId = (session.user as { id?: string }).id;
  let userWalletAddresses: string[] = [];
  if (userId) {
    const [userRow] = await db
      .select({ linkedWalletAddress: users.linkedWalletAddress })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (userRow?.linkedWalletAddress) {
      userWalletAddresses.push(userRow.linkedWalletAddress.toLowerCase());
    }
    const links = await db
      .select({ walletAddress: signerWalletLinks.walletAddress })
      .from(signerWalletLinks)
      .where(eq(signerWalletLinks.userId, userId));
    userWalletAddresses.push(...links.map((l) => l.walletAddress.toLowerCase()));
  }
  userWalletAddresses = [...new Set(userWalletAddresses)];

  const pendingVerifyRow = rosterRows.find(
    (r) =>
      !r.removedAt &&
      (r.verificationStatus === "unverified" || r.verificationStatus === "pending") &&
      userWalletAddresses.includes(r.signerAddress.toLowerCase())
  );

  let initialTransactions: SafeTxItem[] = [];
  try {
    const safeAddress = getAddress(safe.address);
    const base = getSafeTxServiceBaseUrl(safe.network);
    const res = await safeApiFetch(`${base}api/v1/safes/${safeAddress}/multisig-transactions/?executed=true&limit=10&offset=0`);
    if (res.ok) {
      const raw = await res.json();
      type TxRow = { safeTxHash?: string; transactionHash?: string | null; to?: string; value?: string; data?: string | null; submissionDate?: string; executedAt?: string | null; executionDate?: string | null; dataDecoded?: { method?: string } | null };
      const list: TxRow[] = Array.isArray(raw) ? raw : (raw?.results ?? raw?.transactions ?? raw?.items ?? []);
      const mapped = list.map((t) => {
        const value = t.value ?? "0";
        const txType = inferTxType(t.dataDecoded?.method, value, t.data ?? "");
        return { safeTxHash: t.safeTxHash ?? "", transactionHash: t.transactionHash ?? null, to: t.to ?? "", value, submissionDate: t.submissionDate ?? "", executedAt: t.executedAt ?? t.executionDate ?? null, txType };
      });
      initialTransactions = mapped.sort((a, b) => {
        const dateA = a.executedAt ?? a.submissionDate ?? "";
        const dateB = b.executedAt ?? b.submissionDate ?? "";
        return dateB.localeCompare(dateA);
      });
    }
  } catch { /* leave empty */ }

  return (
    <div className="min-w-0 space-y-6">
      {/* Header */}
      <div>
        <Link href="/dashboard/inventory" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Inventory
        </Link>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-foreground truncate">
              {safe.name || `${safe.address.slice(0, 6)}…${safe.address.slice(-4)}`}
            </h1>
            <p className="font-mono text-xs text-muted-foreground break-all mt-1">
              {safe.address}
            </p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
              <span>{team?.name} · {safe.network}</span>
              {snapshot?.implementationVersion ? (
                <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Safe {snapshot.implementationVersion}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <RefreshButton safeId={id} />
            <a href={safeAppUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors">
              Open in Safe
            </a>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-3 grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Threshold</p>
          <p className="text-lg font-semibold text-foreground mt-0.5">
            {snapshot?.threshold != null && ownersList.length > 0 ? `${snapshot.threshold}/${ownersList.length}` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-lg font-semibold text-foreground mt-0.5">
            {pendingCountDisplay !== null ? pendingCountDisplay : (snapshot?.pendingCount ?? "—")}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Signers</p>
          <p className="text-lg font-semibold text-foreground mt-0.5">{ownersList.length > 0 ? ownersList.length : "—"}</p>
        </div>
      </div>

      {/* Balance + Signers row */}
      <div className="grid gap-4 md:grid-cols-5">
        <section className="md:col-span-3 rounded-xl border border-border bg-card p-4" aria-labelledby="safe-balance-heading">
          <h2 id="safe-balance-heading" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Balance</h2>
          <SafeBalance safeId={id} initialBalances={balanceItems} />
        </section>
        <section className="md:col-span-2 rounded-xl border border-border bg-card p-4" aria-labelledby="safe-signers-heading">
          <h2 id="safe-signers-heading" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Signer roster{rosterRows.length > 0 ? ` (${rosterRows.length})` : ""}
          </h2>
          {pendingVerifyRow && (
            <div className="mb-3">
              <VerifyAffiliationBanner
                safeId={id}
                rosterId={pendingVerifyRow.id}
                signerAddress={pendingVerifyRow.signerAddress}
              />
            </div>
          )}
          <SignerRosterTable
            safeId={id}
            canEdit={canEdit}
            roster={rosterRows.map((r) => ({
              id: r.id,
              signerAddress: r.signerAddress,
              displayName: r.displayName,
              signerType: r.signerType,
              roleLabel: r.roleLabel,
              hardwareWallet: r.hardwareWallet,
              isDedicatedSigner: r.isDedicatedSigner,
              verificationStatus: r.verificationStatus,
              verificationMethod: r.verificationMethod,
              source: r.source,
            }))}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Refreshed {snapshot?.refreshedAt ? formatDate(snapshot.refreshedAt) : "never"}
          </p>
        </section>
      </div>

      {!snapshot && (
        <p className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs text-foreground">
          No snapshot yet. Click &ldquo;Refresh&rdquo; to fetch threshold and signers from Safe&apos;s API.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            SEAL compliance
          </h2>
          <ComplianceScorecard summary={compliance} />
        </section>
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Operating profile
          </h2>
          <SafeProfileForm
            safeId={id}
            initialClassification={safe.classification}
            initialPurpose={safe.purpose}
          />
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Security attachments
        </h2>
        <SecurityAttachments
          safeId={id}
          network={safe.network}
          guardAddress={snapshot?.guardAddress ?? null}
          fallbackHandler={snapshot?.fallbackHandler ?? null}
          modules={modulesList}
          moduleExceptionNote={safe.moduleExceptionNote}
          canEdit={canEdit}
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Configuration changes
        </h2>
        <ConfigChangeTimeline safeId={id} />
      </section>

      {/* Transactions + Pending */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <SafeTransactions safeId={id} network={safe.network} initialTransactions={initialTransactions} />
        </div>
        <div className="order-1 lg:order-2">
          <SafePendingTransactions safeId={safe.id} pendingTransactions={initialPendingTransactions} queueUrl={safeAppUrl} />
        </div>
      </div>
    </div>
  );
}
