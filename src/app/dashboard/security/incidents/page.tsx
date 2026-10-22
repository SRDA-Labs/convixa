"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Download, Plus } from "lucide-react";
import { ReportIncidentModal } from "@/components/report-incident-modal";
import { cn } from "@/lib/cn";
import { INCIDENT_STATUS_LABEL } from "@/lib/incidents/constants";

type Incident = {
  id: string;
  incidentType: string;
  severity: string;
  status: string;
  title: string;
  createdAt: string;
};

function severityClass(s: string): string {
  if (s === "critical") return "bg-destructive/10 text-destructive";
  if (s === "high") return "bg-orange-500/10 text-orange-700 dark:text-orange-400";
  if (s === "medium") return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  function load() {
    fetch("/api/org/incidents")
      .then((r) => (r.ok ? r.json() : { incidents: [] }))
      .then((d) => {
        setIncidents(d.incidents ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-6 pb-1">
        <div className="min-w-0">
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            Security incidents
          </h1>
          <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
            Structured incident reporting aligned with SEAL communication guidance
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1 rounded-md bg-destructive px-2.5 py-1 text-[11px] font-medium text-destructive-foreground shrink-0"
        >
          <Plus className="h-3 w-3" />
          Report incident
        </button>
      </header>

      <div className="flex justify-end -mt-1">
        <a
          href="/api/org/incidents-export?format=csv"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Download className="h-3 w-3" />
          Export CSV
        </a>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : incidents.length === 0 ? (
        <p className="text-xs text-muted-foreground py-12 text-center">
          No incidents reported. Use the button above to file a security incident.
        </p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-[11px]">
            <thead className="bg-muted/25 text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left font-medium px-4 py-2.5 w-[38%]">Title</th>
                <th className="text-left font-medium px-4 py-2.5">Type</th>
                <th className="text-left font-medium px-4 py-2.5">Severity</th>
                <th className="text-left font-medium px-4 py-2.5">Status</th>
                <th className="text-left font-medium px-4 py-2.5 whitespace-nowrap">Reported</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id} className="border-t border-border/40 hover:bg-muted/15 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/dashboard/security/incidents/${i.id}`}
                      className="text-primary hover:underline line-clamp-2"
                    >
                      {i.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">
                    {i.incidentType.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                        severityClass(i.severity)
                      )}
                    >
                      {i.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {INCIDENT_STATUS_LABEL[i.status as keyof typeof INCIDENT_STATUS_LABEL] ?? i.status}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap tabular-nums">
                    {new Date(i.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ReportIncidentModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          load();
        }}
      />
    </div>
  );
}
