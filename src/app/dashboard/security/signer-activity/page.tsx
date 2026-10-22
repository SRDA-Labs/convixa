"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle } from "lucide-react";

type ActivityRow = {
  signerAddress: string;
  network: string;
  activityCount7d: number;
  lastOutgoingTxAt: string | null;
  lastOutgoingTxHash: string | null;
};

export default function SignerActivityPage() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/org/signer-activity")
      .then((r) => (r.ok ? r.json() : { activity: [] }))
      .then((d) => {
        setRows(d.activity ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const flagged = rows.filter((r) => r.activityCount7d > 0);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-lg font-semibold tracking-tight">Signer wallet activity</h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          This report shows when a signer&apos;s <strong>personal wallet</strong> (their EOA) sent
          transactions on-chain in the last 7 days — separate from activity through your multisig
          Safes. Unexpected personal-wallet activity can be an early sign of a compromised or
          misused signing key.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3 text-sm">
        <p className="font-medium">What to do</p>
        <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
          <li>
            <strong className="text-foreground font-normal">No rows below?</strong> Good — no
            signers showed outgoing personal-wallet transfers in the last week (or data has not been
            collected yet).
          </li>
          <li>
            <strong className="text-foreground font-normal">A signer appears in the table?</strong>{" "}
            Confirm with them whether the transfers were expected (e.g. gas funding, personal use).
            If not, treat it as a potential security issue and follow your{" "}
            <Link href="/dashboard/security/incidents" className="text-primary hover:underline">
              incident process
            </Link>
            .
          </li>
          <li>
            <strong className="text-foreground font-normal">Want alerts?</strong> Create an alert
            rule for <code className="text-xs">signer_eoa_activity</code> under{" "}
            <Link href="/dashboard/alerts" className="text-primary hover:underline">
              Alerts
            </Link>{" "}
            so your team is notified automatically.
          </li>
        </ul>
        <p className="text-xs text-muted-foreground pt-1 border-t border-border/60">
          Convixa checks public blockchain data for addresses on your signer roster. Some Safe or
          wallet apps may look like personal transfers — always verify with the signer before
          escalating.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : flagged.length === 0 ? (
        <div className="rounded-xl border border-border p-6 text-center space-y-2">
          <p className="text-sm font-medium">No flagged activity in the last 7 days</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {rows.length === 0
              ? "Activity monitoring may not be running yet. Your administrator can enable periodic checks so this page stays up to date."
              : "All monitored signers had no outgoing personal-wallet transfers this week."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              <strong>{flagged.length}</strong> signer
              {flagged.length === 1 ? "" : "s"} with outgoing personal-wallet activity in the last
              7 days — review with each signer.
            </p>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5">Signer address</th>
                  <th className="px-4 py-2.5">Network</th>
                  <th className="px-4 py-2.5">Outgoing txs (7d)</th>
                  <th className="px-4 py-2.5">Last transfer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {flagged.map((r) => (
                  <tr key={`${r.signerAddress}-${r.network}`} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{r.signerAddress}</td>
                    <td className="px-4 py-3 text-xs capitalize">{r.network}</td>
                    <td className="px-4 py-3">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-700">
                        {r.activityCount7d}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.lastOutgoingTxAt
                        ? new Date(r.lastOutgoingTxAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
