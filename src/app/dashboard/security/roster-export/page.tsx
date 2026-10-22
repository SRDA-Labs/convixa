"use client";

import { Download } from "lucide-react";

export default function RosterExportPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Roster export</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Export org-wide signer roster for protocol documentation and audits (SEAL Phase 2).
        </p>
      </header>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          Includes safe metadata, signer addresses, roles, types, hardware self-report, and verification status.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/org/signer-roster-export?format=csv"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </a>
          <a
            href="/api/org/signer-roster-export?format=json"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
          >
            View JSON
          </a>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="text-sm font-medium">Signer rotation log</h2>
        <p className="text-sm text-muted-foreground">
          Config change events for signer adds, removals, swaps, and threshold changes (SEAL Phase 4 readiness pack).
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/org/signer-rotation-export?format=csv"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
          >
            <Download className="h-3.5 w-3.5" />
            Rotation CSV
          </a>
        </div>
      </div>
    </div>
  );
}
