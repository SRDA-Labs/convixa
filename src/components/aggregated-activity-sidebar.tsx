import Link from "next/link";
import {
  FileText,
  ArrowDownLeft,
  CheckCircle2,
  CircleCheck,
  Settings,
  UserPlus,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/cn";

export type AuditEntry = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: unknown;
  createdAt: Date;
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3600_000);
  const diffDays = Math.floor(diffMs / 86400_000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function getActivityLabel(entry: AuditEntry): string {
  const a = entry.action;
  const r = entry.resourceType;
  if (a === "safe.create" && r === "safe") return "New Safe added";
  if (a === "safe.remove" && r === "safe") return "Safe removed";
  if (a.includes("proposal") || a.includes("transaction")) return "New proposal";
  if (a.includes("sign") || a.includes("approval")) return "Signature added";
  if (a.includes("executed") || a.includes("execute")) return "Transaction executed";
  if (a.includes("threshold") || a.includes("update")) return "Threshold updated";
  if (a.includes("signer") || a.includes("owner")) return "Signer added";
  if (a.includes("transfer") || a.includes("inbound")) return "Inbound transfer";
  return `${a.replace(/\./g, " ")} • ${r}`;
}

function getActivityIcon(entry: AuditEntry) {
  const a = entry.action;
  if (a === "safe.create" || a.includes("proposal")) return FileText;
  if (a.includes("transfer") || a.includes("inbound")) return ArrowDownLeft;
  if (a.includes("sign") || a.includes("approval")) return CheckCircle2;
  if (a.includes("executed") || a.includes("execute")) return CircleCheck;
  if (a.includes("threshold") || a.includes("update")) return Settings;
  if (a.includes("signer") || a.includes("owner")) return UserPlus;
  return FileText;
}

export function AggregatedActivitySidebar({ entries }: { entries: AuditEntry[] }) {
  return (
    <aside
      className="w-full lg:w-80 shrink-0 overflow-y-auto bg-background/30 dark:bg-background/20 flex flex-col min-h-0 rounded-lg"
      aria-labelledby="aggregated-activity-heading"
    >
      <div className="p-6 flex-1 min-h-0">
        <div className="flex items-center justify-between mb-6">
          <h2
            id="aggregated-activity-heading"
            className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest"
          >
            Aggregated Activity
          </h2>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded p-0.5"
            aria-label="Filter activity"
          >
            <Filter className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="relative space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-0 before:w-px before:bg-border">
          {entries.length === 0 ? (
            <p className="text-[10px] text-muted-foreground py-4 pl-7">No recent activity.</p>
          ) : (
            entries.slice(0, 15).map((entry, i) => {
              const Icon = getActivityIcon(entry);
              const isFirst = i === 0;
              const isOlder = i >= 3;
              return (
                <div key={entry.id} className={cn("relative pl-7", isOlder && "opacity-60")}>
                  <span
                    className={cn(
                      "absolute left-0 top-1 size-4 rounded-full flex items-center justify-center",
                      isFirst ? "bg-primary text-primary-foreground" : "bg-slate-800 border border-border"
                    )}
                  >
                    <Icon className="h-2.5 w-2.5 text-[10px]" aria-hidden />
                  </span>
                  <div>
                    <p className="text-xs font-bold leading-tight text-foreground">
                      {getActivityLabel(entry)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatRelativeTime(new Date(entry.createdAt))}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <Link
          href="/dashboard/audit"
          className="block w-full mt-8 py-2 rounded border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-white/5 dark:hover:bg-white/5 uppercase tracking-widest text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
        >
          View Historical Log
        </Link>
      </div>
    </aside>
  );
}
