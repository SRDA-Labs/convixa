"use client";

import { useEffect, useState } from "react";
import { Loader2, Download, FileJson } from "lucide-react";
import { cn } from "@/lib/cn";

type Preview = {
  manifest: {
    schemaVersion: string;
    exportedAt?: string;
    phaseCoverage: string[];
    sectionCount: number;
  };
  readinessScore: number;
  timelockCoveragePct: number;
  criticalPolicyGaps: number;
};

export function CertificationClient({ canExport }: { canExport: boolean }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetch("/api/org/seal-certification-export?preview=true")
      .then((r) => (r.ok ? r.json() : null))
      .then(setPreview)
      .finally(() => setLoading(false));
  }, []);

  async function download() {
    setExporting(true);
    try {
      const res = await fetch("/api/org/seal-certification-export");
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "seal-certification-pack.json";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading preview…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="rounded-xl border border-border p-4 space-y-3">
        <h2 className="text-sm font-medium">Pack preview</h2>
        {preview ? (
          <ul className="text-sm space-y-2 text-muted-foreground">
            <li>Schema: {preview.manifest.schemaVersion}</li>
            <li>Sections: {preview.manifest.sectionCount}</li>
            <li>Phases: {preview.manifest.phaseCoverage.join(", ")}</li>
            <li>Readiness score: {preview.readinessScore}%</li>
            <li>Timelock coverage: {preview.timelockCoveragePct}%</li>
            <li
              className={cn(
                preview.criticalPolicyGaps > 0 && "text-amber-600 dark:text-amber-400"
              )}
            >
              Critical policy gaps: {preview.criticalPolicyGaps}
            </li>
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Preview unavailable.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {canExport ? (
          <button
            type="button"
            onClick={download}
            disabled={exporting}
            className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download certification pack
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">
            You need <strong>certification:export</strong> permission to download the full pack.
            Security Leads have this by default.
          </p>
        )}
        <a
          href="/api/org/seal-certification-export?format=csv"
          className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-md border border-border hover:bg-muted"
        >
          <FileJson className="h-4 w-4" />
          Summary CSV
        </a>
      </div>

      <p className="text-xs text-muted-foreground">
        The full pack is a structured JSON document with readiness, governance, roster, drills,
        policy gaps, delay attachments, and audit excerpts. Regenerate every 90 days for auditor reviews.
      </p>
    </div>
  );
}
