"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AddSafeForm } from "./add-safe-form";
import type { AddSafeInitialValues } from "./add-safe-modal-provider";

export function AddSafeModal({
  open,
  onClose,
  initialValues,
}: {
  open: boolean;
  onClose: () => void;
  initialValues: AddSafeInitialValues;
}) {
  const router = useRouter();

  const handleSuccess = useCallback(
    (safeId: string) => {
      onClose();
      router.push(`/dashboard/safes/${safeId}`);
      router.refresh();
    },
    [onClose, router]
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-safe-modal-title"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 -z-10"
        aria-label="Close modal"
      />
      <div
        className="relative w-full max-w-lg rounded-xl border border-border bg-card shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 id="add-safe-modal-title" className="text-lg font-semibold text-foreground">
            Add Safe
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <AddSafeForm onSuccess={handleSuccess} onCancel={onClose} initialValues={initialValues} />
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}
