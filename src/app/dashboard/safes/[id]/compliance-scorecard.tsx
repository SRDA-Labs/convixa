"use client";

import { useMemo, useState } from "react";
import type { ComplianceSummary } from "@/lib/seal-compliance/types";
import { cn } from "@/lib/cn";

type IssueFilter = "issues" | "all";

export function ComplianceScorecard({ summary }: { summary: ComplianceSummary }) {
  const [filter, setFilter] = useState<IssueFilter>("issues");

  const visibleResults = useMemo(() => {
    const list =
      filter === "all"
        ? summary.results
        : summary.results.filter((r) => r.status === "warn" || r.status === "fail");
    const order = { fail: 0, warn: 1, pass: 2 };
    return [...list].sort(
      (a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9)
    );
  }, [filter, summary.results]);

  const issueCount = summary.warn + summary.fail;
  const scrollable = visibleResults.length > 5;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 font-medium">
          {summary.pass} pass
        </span>
        <span className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 font-medium">
          {summary.warn} warn
        </span>
        <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 font-medium">
          {summary.fail} fail
        </span>
        <span className="h-3 w-px bg-border shrink-0" aria-hidden />
        <div
          role="group"
          aria-label="Filter compliance results"
          className="inline-flex rounded-md border border-border/80 p-0.5"
        >
          <button
            type="button"
            onClick={() => setFilter("issues")}
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
              filter === "issues"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Issues only
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
              filter === "all"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All checks
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Recommended: {summary.recommendedThreshold}-of-{summary.recommendedOwners}
        {summary.inferredClassification ? ` · ${summary.inferredClassification}` : ""}
      </p>

      {visibleResults.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          {filter === "issues" && issueCount === 0
            ? "No warnings or failures — all checks passing."
            : "No results to show."}
        </p>
      ) : (
        <ul
          className={cn(
            "space-y-2",
            scrollable && "max-h-[13.5rem] overflow-y-auto pr-1 -mr-1"
          )}
        >
          {visibleResults.map((r) => (
            <li key={r.ruleId} className="text-xs border-b border-border/60 pb-2 last:border-0">
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                    r.status === "pass" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                    r.status === "warn" && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                    r.status === "fail" && "bg-destructive/10 text-destructive"
                  )}
                >
                  {r.status}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{r.message}</p>
                  {r.remediation && (
                    <p className="text-muted-foreground mt-0.5">{r.remediation}</p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {scrollable && (
        <p className="text-[10px] text-muted-foreground">
          Showing {visibleResults.length} {filter === "issues" ? "issue" : "check"}
          {visibleResults.length === 1 ? "" : "s"} — scroll for more
        </p>
      )}

      <a
        href="https://frameworks.securityalliance.org/wallet-security/secure-multisig-best-practices/"
        className="text-[11px] text-primary hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        SEAL Secure Multisig Best Practices
      </a>
    </div>
  );
}
