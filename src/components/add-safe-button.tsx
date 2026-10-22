"use client";

import { useAddSafeModal } from "./add-safe-modal-provider";
import { PlusCircle } from "lucide-react";

export function AddSafeButton({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const ctx = useAddSafeModal();
  if (!ctx) return null;
  const defaultClass =
    "inline-flex items-center justify-center gap-2 min-h-[44px] rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2";
  return (
    <button
      type="button"
      onClick={() => ctx.setOpen(true)}
      className={className ?? defaultClass}
    >
      {children ?? (
        <>
          <PlusCircle className="h-4 w-4 shrink-0" aria-hidden />
          Add Safe
        </>
      )}
    </button>
  );
}
