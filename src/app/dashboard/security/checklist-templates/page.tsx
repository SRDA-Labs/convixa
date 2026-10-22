import { getDefaultOrgId } from "@/lib/auth-server";
import { userCanManageSecurityHub } from "@/lib/security-access-server";
import { ChecklistTemplatesClient } from "./checklist-templates-client";

export const dynamic = "force-dynamic";

export default async function ChecklistTemplatesPage() {
  const orgId = await getDefaultOrgId();
  const canEdit = orgId ? await userCanManageSecurityHub(orgId) : false;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Checklist templates</h1>
        <p className="text-sm text-muted-foreground">
          Customize pre-sign review checklists per transaction type for your organization
        </p>
      </header>
      <ChecklistTemplatesClient canEdit={canEdit} />
    </div>
  );
}
