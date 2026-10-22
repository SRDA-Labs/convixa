import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDefaultOrgId } from "@/lib/auth-server";
import { AlertsClient } from "./alerts-client";

export default async function AlertsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const orgId = await getDefaultOrgId();
  if (!orgId) {
    return (
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Alerts</h1>
        <p className="text-sm text-muted-foreground">No organization selected.</p>
      </div>
    );
  }

  return <AlertsClient />;
}
