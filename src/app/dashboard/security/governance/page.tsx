import { redirect } from "next/navigation";

/** Governance dashboard removed from Security hub for now. */
export default function GovernancePage() {
  redirect("/dashboard/security/readiness");
}
