import { getDefaultOrgId } from "@/lib/auth-server";
import { userCanManageSecurityHub } from "@/lib/security-access-server";
import { DrillsClient } from "./drills-client";

export const dynamic = "force-dynamic";

export default async function DrillsPage() {
  const orgId = await getDefaultOrgId();
  const canManage = orgId ? await userCanManageSecurityHub(orgId) : false;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Emergency drills</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Schedule and log tabletop exercises, testnet drills, and failover walkthroughs.
        </p>
      </div>
      <DrillsClient canManage={canManage} />
    </div>
  );
}
