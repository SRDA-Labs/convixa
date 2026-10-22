import { Suspense } from "react";
import { getDefaultOrgId } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { ListDetailClient } from "./list-detail-client";

export default async function ControlsListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const orgId = await getDefaultOrgId();
  if (!orgId) redirect("/dashboard");
  await params;

  return (
    <div className="space-y-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <ListDetailClient />
      </Suspense>
    </div>
  );
}
