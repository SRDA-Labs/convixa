import { Suspense } from "react";
import { getDefaultOrgId } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { SubscriptionListDetailClient } from "./subscription-list-detail-client";

export default async function SubscriptionListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const orgId = await getDefaultOrgId();
  if (!orgId) redirect("/dashboard");
  await params;

  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <SubscriptionListDetailClient />
    </Suspense>
  );
}
