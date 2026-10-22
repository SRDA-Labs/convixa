import { getDefaultOrgId } from "@/lib/auth-server";
import { userCanManageSecurityHub } from "@/lib/security-access-server";
import { PlaybooksClient } from "./playbooks-client";

export const dynamic = "force-dynamic";

export default async function PlaybooksPage() {
  const orgId = await getDefaultOrgId();
  const canEdit = orgId ? await userCanManageSecurityHub(orgId) : false;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Disaster recovery playbooks</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Versioned emergency procedures for signer compromise, outages, and malicious transactions.
        </p>
      </div>
      <PlaybooksClient canEdit={canEdit} />
    </div>
  );
}
