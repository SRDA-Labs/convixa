import Link from "next/link";
import { PendingReviewsClient } from "./pending-reviews-client";

export const dynamic = "force-dynamic";

export default function PendingReviewsPage() {
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Pending reviews</h1>
          <p className="text-sm text-muted-foreground">
            Pre-sign checklist completion across pending multisig transactions
          </p>
        </div>
        <Link
          href="/dashboard/security/checklist-templates"
          className="text-sm text-primary hover:underline shrink-0"
        >
          Checklist templates →
        </Link>
      </header>
      <PendingReviewsClient />
    </div>
  );
}
