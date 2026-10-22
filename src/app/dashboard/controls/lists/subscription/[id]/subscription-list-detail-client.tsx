"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SubscriptionListPanel } from "../../subscription-list-panel";

export function SubscriptionListDetailClient() {
  const params = useParams();
  const id = params.id as string;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/controls/lists"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back to lists
        </Link>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Alert subscription list</p>
      </div>
      <SubscriptionListPanel listId={id} />
    </div>
  );
}
