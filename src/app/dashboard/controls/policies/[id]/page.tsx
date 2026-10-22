import { getDefaultOrgId } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { PolicyDetailClient } from "./policy-detail-client";

export default async function ControlsPolicyDetailPage() {
  const orgId = await getDefaultOrgId();
  if (!orgId) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <PolicyDetailClient />
    </div>
  );
}
