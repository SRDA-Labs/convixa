import { getDefaultOrgId } from "@/lib/auth-server";
import { userCanManageSecurityHub } from "@/lib/security-access-server";
import { OnboardingClient } from "./onboarding-client";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const orgId = await getDefaultOrgId();
  const canEdit = orgId ? await userCanManageSecurityHub(orgId) : false;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Signer onboarding</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track training and readiness for each signer on your roster.
        </p>
      </div>
      <OnboardingClient canEdit={canEdit} />
    </div>
  );
}
