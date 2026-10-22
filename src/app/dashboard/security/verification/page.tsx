"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

type SafeCoverage = {
  safeId: string;
  safeName: string | null;
  total: number;
  verified: number;
  classification: string | null;
};

export default function VerificationCoveragePage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{
    totalSigners: number;
    verifiedCount: number;
    verificationPct: number;
    unverifiedCount: number;
  } | null>(null);
  const [bySafe, setBySafe] = useState<SafeCoverage[]>([]);

  useEffect(() => {
    fetch("/api/org/verification-coverage")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setSummary(d.summary);
          setBySafe(d.bySafe ?? []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Verification coverage</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Org-wide signer affiliation verification for SEAL accountability (Phase 2).
        </p>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !summary ? (
        <p className="text-sm text-muted-foreground">Unable to load coverage data.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">Total signers</p>
              <p className="text-2xl font-semibold">{summary.totalSigners}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">Verified</p>
              <p className="text-2xl font-semibold">{summary.verifiedCount}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">Coverage</p>
              <p className="text-2xl font-semibold">{summary.verificationPct}%</p>
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5">Safe</th>
                  <th className="px-4 py-2.5">Classification</th>
                  <th className="px-4 py-2.5">Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {bySafe.map((s) => (
                  <tr key={s.safeId} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/safes/${s.safeId}`} className="hover:text-primary text-xs">
                        {s.safeName ?? s.safeId.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.classification ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      {s.verified}/{s.total}
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
