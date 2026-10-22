import { redirect } from "next/navigation";
import { getDefaultOrgId } from "@/lib/auth-server";
import { getAuditLogsByOrg } from "@/lib/db/repositories";

export default async function DashboardAuditPage() {
  const orgId = await getDefaultOrgId();
  if (!orgId) redirect("/dashboard");

  const logs = await getAuditLogsByOrg(orgId, { limit: 100 });

  return (
    <div className="min-w-0 space-y-6">
      <header className="border-b border-border pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl text-pretty">
          Historical Log
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Audit trail of organization activity.
        </p>
      </header>
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3.5 font-medium">Time</th>
                <th className="px-4 py-3.5 font-medium">Action</th>
                <th className="px-4 py-3.5 font-medium">Resource</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                    No audit entries yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{log.action}</td>
                    <td className="px-4 py-3 text-muted-foreground">{log.resourceType}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
