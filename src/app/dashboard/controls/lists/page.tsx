import { Suspense } from "react";
import { ListsClient } from "./lists-client";

export default function ListsPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading address lists…</p>}>
        <ListsClient />
      </Suspense>
    </div>
  );
}
