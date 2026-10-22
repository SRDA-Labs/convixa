import { getDefaultOrgId } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { PoliciesClient } from "./policies-client";

export default async function ControlsPoliciesPage() {
  const orgId = await getDefaultOrgId();
  if (!orgId) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <PoliciesClient />
    </div>
  );
}
