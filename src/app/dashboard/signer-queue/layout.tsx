import { redirect } from "next/navigation";
import { getDefaultOrgId, getUserPermissions } from "@/lib/auth-server";
import { canUseSignerWorkflow, canAccessSecurityHub } from "@/lib/security-access";

export default async function SignerQueueLayout({ children }: { children: React.ReactNode }) {
  const orgId = await getDefaultOrgId();
  if (!orgId) redirect("/dashboard");

  const permissions = await getUserPermissions(orgId);
  if (!canUseSignerWorkflow(permissions) && !canAccessSecurityHub(permissions)) {
    redirect("/dashboard");
  }

  return children;
}
