import { redirect } from "next/navigation";
import { SecuritySubnav } from "@/components/security-subnav";
import { getDefaultOrgId, getUserPermissions } from "@/lib/auth-server";
import { syncDefaultOrgRoles } from "@/lib/default-roles";
import {
  canAccessSecurityHub,
  canUseSignerWorkflow,
  filterSecurityTabs,
} from "@/lib/security-access";

export default async function SecurityLayout({ children }: { children: React.ReactNode }) {
  const orgId = await getDefaultOrgId();
  if (!orgId) redirect("/dashboard");

  await syncDefaultOrgRoles(orgId);
  const permissions = await getUserPermissions(orgId);

  if (!canAccessSecurityHub(permissions)) {
    if (canUseSignerWorkflow(permissions)) {
      redirect("/dashboard/signer-queue");
    }
    redirect("/dashboard");
  }

  const tabs = filterSecurityTabs(permissions);

  return (
    <div className="min-w-0 space-y-6">
      <SecuritySubnav tabs={tabs} />
      {children}
    </div>
  );
}
