import { redirect } from "next/navigation";
import { orgHubUrl } from "@/lib/org-management/constants";

export default async function SettingsMembersRedirect({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  redirect(orgHubUrl("members", page ? { page } : undefined));
}
