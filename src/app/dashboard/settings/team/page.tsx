import { redirect } from "next/navigation";
import { orgHubUrl } from "@/lib/org-management/constants";

export default async function TeamSettingsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { tab, page } = await searchParams;
  const resolvedTab =
    tab === "invites" || tab === "roles" ? tab : tab === "members" ? "members" : "members";
  redirect(orgHubUrl(resolvedTab, page ? { page } : undefined));
}
