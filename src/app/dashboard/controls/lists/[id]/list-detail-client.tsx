"use client";

import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AddressBookPanel } from "../address-book-panel";

export function ListDetailClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const prefilledAddress = searchParams.get("add")?.trim() ?? "";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/controls/lists"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back to lists
        </Link>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">On-chain address book</p>
      </div>
      <AddressBookPanel listId={id} prefilledAddress={prefilledAddress} />
    </div>
  );
}
