import { redirect } from "next/navigation";

/** Certification UI removed from Security hub — export via API or Readiness. */
export default function CertificationPage() {
  redirect("/dashboard/security/readiness");
}
