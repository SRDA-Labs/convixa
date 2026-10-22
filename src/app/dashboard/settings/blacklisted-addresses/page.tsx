import { getDefaultOrgId, isOrgAdmin } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { OrgBlacklistedAddressesList } from "./org-blacklisted-addresses-list";

export default async function SettingsBlacklistedAddressesPage() {
  const orgId = await getDefaultOrgId();
  if (!orgId) redirect("/dashboard");
  const admin = await isOrgAdmin(orgId);
  if (!admin) {
    return (
      <p className="text-muted-foreground text-sm">Only org admins can manage blacklisted addresses.</p>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Blacklisted addresses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Addresses in this list are blacklisted for your org. When a pending transaction has a destination in the global blacklist or this list, the destination blacklist alert can fire.
        </p>
      </div>
      <OrgBlacklistedAddressesList />
    </div>
  );
}
