import { redirect } from "next/navigation";
import { orgHubUrl } from "@/lib/org-management/constants";

export default function RolesRedirect() {
  redirect(orgHubUrl("roles"));
}
