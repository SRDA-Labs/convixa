"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Download } from "lucide-react";
import { cn } from "@/lib/cn";

type SignerEntry = {
  signerAddress: string;
  safes: Array<{
    safeId: string;
    safeName: string | null;
    safeAddress: string;
    network: string;
  }>;
  flags: string[];
  verificationVerified?: number;
  verificationTotal?: number;
};

function flagLabel(f: string): string {
  const map: Record<string, string> = {
    concentration: "3+ safes",
    tag_conflict: "Cold + hot tags",
    sole_signer: "Sole signer (1/1)",
  };
  return map[f] ?? f;
}

export default function SignerOverlapPage() {
  const [signers, setSigners] = useState<SignerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/org/signer-overlap")
      .then((r) => (r.ok ? r.json() : { signers: [] }))
      .then((d) => {
        setSigners(d.signers ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Signer overlap</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Org-wide view of signer concentration and tag conflicts (SEAL distribution guidance).
          </p>
        </div>
        <a
          href="/api/org/signer-overlap?format=csv"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </a>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : signers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No signer data. Add safes and refresh snapshots.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5">Signer</th>
                <th className="px-4 py-2.5">Safes</th>
                <th className="px-4 py-2.5">Verified</th>
                <th className="px-4 py-2.5">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {signers
                .filter((s) => s.flags.length > 0 || s.safes.length >= 2)
                .map((entry) => (
                  <tr key={entry.signerAddress} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{entry.signerAddress}</td>
                    <td className="px-4 py-3 text-xs">
                      <ul className="space-y-1">
                        {entry.safes.map((s) => (
                          <li key={s.safeId}>
                            <Link href={`/dashboard/safes/${s.safeId}`} className="hover:text-primary">
                              {s.safeName ?? `${s.safeAddress.slice(0, 8)}…`}
                            </Link>
                            <span className="text-muted-foreground ml-1">({s.network})</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {(entry.verificationTotal ?? 0) > 0
                        ? `${entry.verificationVerified ?? 0}/${entry.verificationTotal}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {entry.flags.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          entry.flags.map((f) => (
                            <span
                              key={f}
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                f === "sole_signer"
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              )}
                            >
                              {flagLabel(f)}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
