"use client";

import { useState } from "react";
import { FilePlus2 } from "lucide-react";
import { ProposeTxModal } from "@/components/propose-tx/propose-tx-modal";
import type { ProposeSafeOption } from "@/components/propose-tx/types";

export function ProposeTxButton({ safes }: { safes: ProposeSafeOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={safes.length === 0}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-50 min-h-[36px]"
      >
        <FilePlus2 className="h-3.5 w-3.5" aria-hidden />
        Propose transaction
      </button>
      <ProposeTxModal open={open} onClose={() => setOpen(false)} safes={safes} />
    </>
  );
}
