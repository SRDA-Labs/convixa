import { getUserPermissions } from "@/lib/auth-server";
import { canManageSecurity } from "@/lib/security-access";

export async function userCanManageSecurityHub(orgId: string): Promise<boolean> {
  const permissions = await getUserPermissions(orgId);
  return canManageSecurity(permissions);
}
