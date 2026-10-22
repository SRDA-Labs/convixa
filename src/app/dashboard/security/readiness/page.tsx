import { getDefaultOrgId } from "@/lib/auth-server";
import { userCanManageSecurityHub } from "@/lib/security-access-server";
import { ReadinessClient } from "./readiness-client";

export const dynamic = "force-dynamic";

export default async function ReadinessPage() {
  const orgId = await getDefaultOrgId();
  const canManage = orgId ? await userCanManageSecurityHub(orgId) : false;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Emergency readiness</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Org-wide posture across onboarding, drills, playbooks, and operational workflows.
        </p>
      </div>
      <ReadinessClient canManage={canManage} />
    </div>
  );
}
