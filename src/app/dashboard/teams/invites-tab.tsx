import { fetchInviteData } from "@/lib/org-management/data";
import { InvitesClient } from "../settings/invites/invites-client";

export async function InvitesTab({ orgId }: { orgId: string }) {
  const data = await fetchInviteData(orgId);
  return (
    <InvitesClient
      activeInvites={data.activeInvites}
      historyInvites={data.historyInvites}
      teams={data.teamsForSelect}
    />
  );
}
