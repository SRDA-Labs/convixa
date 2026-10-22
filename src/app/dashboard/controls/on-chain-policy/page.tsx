import { getDefaultOrgId } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { OnChainPolicyClient } from "./on-chain-policy-client";

export default async function OnChainPolicyPage() {
  const orgId = await getDefaultOrgId();
  if (!orgId) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <OnChainPolicyClient />
    </div>
  );
}
