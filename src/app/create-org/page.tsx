import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { ensureDefaultOrgForUser } from "@/lib/org-bootstrap";

/** Legacy route — orgs are created automatically on first dashboard visit. */
export default async function CreateOrgPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const userId = (session.user as { id?: string }).id;
  if (userId) {
    await ensureDefaultOrgForUser(userId);
  }

  redirect("/dashboard");
}
