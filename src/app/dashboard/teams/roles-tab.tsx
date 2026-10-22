import { fetchRolesData } from "@/lib/org-management/data";
import { RolesList } from "../settings/roles/roles-list";

export async function RolesTab({ orgId }: { orgId: string }) {
  const data = await fetchRolesData(orgId);
  return (
    <RolesList
      orgId={orgId}
      initialRoles={data.rolesWithPerms}
      tableRows={data.tableRows}
      totalRoles={data.totalRoles}
      canCreate={data.canCreate}
      canUpdate={data.canUpdate}
      canDelete={data.canDelete}
    />
  );
}
