import { redirect } from "next/navigation";
import { orgHubUrl } from "@/lib/org-management/constants";

export default function MembersRedirect() {
  redirect(orgHubUrl("members"));
}
