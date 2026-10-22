import { redirect } from "next/navigation";

/** Legacy URL: /dashboard/overview → /dashboard */
export default function DashboardOverviewRedirect() {
  redirect("/dashboard");
}
