"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useProposeWizardState } from "./use-propose-wizard-state";
import { templateLabel, type ProposeSafeOption } from "./types";
import { TemplateStep } from "./steps/template-step";
import { ParamsStep } from "./steps/params-step";
import { SelectSafesStep } from "./steps/select-safes-step";
import { SummaryProposeStep } from "./steps/summary-propose-step";

const STEP_TITLES = [
  "Choose template",
  "Enter details",
  "Select Safes",
  "Review & propose",
] as const;

export function ProposeTxModal({
  open,
  onClose,
  safes,
}: {
  open: boolean;
  onClose: () => void;
  safes: ProposeSafeOption[];
}) {
  const wizard = useProposeWizardState(safes);

  useEffect(() => {
    if (!open) {
      wizard.reset();
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when open flips
  }, [open, onClose]);

  const canNext =
    wizard.state.step === 1
      ? Boolean(wizard.state.template)
      : wizard.state.step === 2
        ? !wizard.step2Error && Boolean(wizard.operation)
        : wizard.state.step === 3
          ? wizard.selectedSafes.length > 0
          : false;

  const goNext = useCallback(() => {
    if (wizard.state.step === 1 && wizard.state.template) {
      wizard.setStep(2);
      return;
    }
    if (wizard.state.step === 2 && !wizard.step2Error && wizard.operation) {
      wizard.setStep(3);
      return;
    }
    if (wizard.state.step === 3 && wizard.selectedSafes.length > 0) {
      wizard.setStep(4);
    }
  }, [wizard]);

  const goBack = useCallback(() => {
    if (wizard.state.step === 2) wizard.setStep(1);
    else if (wizard.state.step === 3) wizard.setStep(2);
    else if (wizard.state.step === 4) wizard.setStep(3);
  }, [wizard]);

  if (!open) return null;

  const title =
    wizard.state.template && wizard.state.step > 1
      ? `${templateLabel(wizard.state.template)} · ${STEP_TITLES[wizard.state.step - 1]}`
      : STEP_TITLES[wizard.state.step - 1];

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="propose-tx-modal-title"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 -z-10"
        aria-label="Close modal"
      />
      <div
        className="relative flex w-full max-w-2xl max-h-[90vh] flex-col rounded-xl border border-border bg-card shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
          <div>
            <h2
              id="propose-tx-modal-title"
              className="text-lg font-semibold text-foreground"
            >
              Propose transaction
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Step {wizard.state.step} of 4 — {title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {wizard.state.step === 1 && (
            <TemplateStep
              selected={wizard.state.template}
              onSelect={wizard.setTemplate}
            />
          )}
          {wizard.state.step === 2 && wizard.state.template && (
            <ParamsStep
              template={wizard.state.template}
              primaryAddress={wizard.state.primaryAddress}
              secondaryAddress={wizard.state.secondaryAddress}
              threshold={wizard.state.threshold}
              onChange={wizard.patch}
              error={wizard.step2Error}
            />
          )}
          {wizard.state.step === 3 && (
            <SelectSafesStep
              eligible={wizard.eligibleSafes}
              selectedIds={wizard.state.selectedSafeIds}
              onToggle={wizard.toggleSafe}
              onSelectAllEligible={() =>
                wizard.selectAllEligible(
                  wizard.eligibleSafes.filter((e) => !e.reason).map((e) => e.safe.id)
                )
              }
            />
          )}
          {wizard.state.step === 4 && wizard.operation && (
            <SummaryProposeStep
              safes={wizard.selectedSafes}
              operation={wizard.operation}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-3 shrink-0 bg-card">
          <button
            type="button"
            onClick={wizard.state.step === 1 ? onClose : goBack}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            {wizard.state.step === 1 ? "Cancel" : "Back"}
          </button>
          {wizard.state.step < 4 ? (
            <button
              type="button"
              disabled={!canNext}
              onClick={goNext}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}
