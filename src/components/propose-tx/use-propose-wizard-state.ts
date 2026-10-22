"use client";

import { useCallback, useMemo, useState } from "react";
import {
  INITIAL_WIZARD_STATE,
  type ProposeSafeOption,
  type ProposeTemplate,
  type ProposeWizardState,
} from "./types";
import {
  isValidEthAddress,
  normalizeAddress,
  type OwnerChangeOperation,
  validateOwnerChangeForSafe,
} from "@/lib/safe-propose/owner-change";

export function useProposeWizardState(safes: ProposeSafeOption[]) {
  const [state, setState] = useState<ProposeWizardState>(INITIAL_WIZARD_STATE);

  const reset = useCallback(() => setState(INITIAL_WIZARD_STATE), []);

  const setStep = useCallback((step: ProposeWizardState["step"]) => {
    setState((s) => ({ ...s, step }));
  }, []);

  const setTemplate = useCallback((template: ProposeTemplate) => {
    setState((s) => ({
      ...s,
      template,
      step: 2,
      // sensible default threshold from first safe
      threshold:
        s.threshold && Number(s.threshold) > 0
          ? s.threshold
          : String(safes[0]?.threshold ?? 1),
    }));
  }, [safes]);

  const patch = useCallback((partial: Partial<ProposeWizardState>) => {
    setState((s) => ({ ...s, ...partial }));
  }, []);

  const toggleSafe = useCallback((safeId: string) => {
    setState((s) => {
      const has = s.selectedSafeIds.includes(safeId);
      return {
        ...s,
        selectedSafeIds: has
          ? s.selectedSafeIds.filter((id) => id !== safeId)
          : [...s.selectedSafeIds, safeId],
      };
    });
  }, []);

  const selectAllEligible = useCallback(
    (eligibleIds: string[]) => {
      setState((s) => ({ ...s, selectedSafeIds: eligibleIds }));
    },
    []
  );

  const operation = useMemo((): OwnerChangeOperation | null => {
    if (!state.template) return null;
    try {
      if (state.template === "add") {
        if (!isValidEthAddress(state.primaryAddress)) return null;
        const threshold = parseInt(state.threshold, 10);
        if (!Number.isFinite(threshold)) return null;
        return {
          type: "add",
          ownerAddress: normalizeAddress(state.primaryAddress),
          threshold,
        };
      }
      if (state.template === "remove") {
        if (!isValidEthAddress(state.primaryAddress)) return null;
        const threshold = parseInt(state.threshold, 10);
        if (!Number.isFinite(threshold)) return null;
        return {
          type: "remove",
          ownerAddress: normalizeAddress(state.primaryAddress),
          threshold,
        };
      }
      if (
        !isValidEthAddress(state.secondaryAddress) ||
        !isValidEthAddress(state.primaryAddress)
      ) {
        return null;
      }
      return {
        type: "rotate",
        oldOwnerAddress: normalizeAddress(state.secondaryAddress),
        newOwnerAddress: normalizeAddress(state.primaryAddress),
      };
    } catch {
      return null;
    }
  }, [state]);

  const step2Error = useMemo(() => {
    if (!state.template) return "Select a template";
    if (state.template === "rotate") {
      if (!isValidEthAddress(state.secondaryAddress)) return "Enter a valid old owner address";
      if (!isValidEthAddress(state.primaryAddress)) return "Enter a valid new owner address";
      if (
        state.secondaryAddress.trim().toLowerCase() ===
        state.primaryAddress.trim().toLowerCase()
      ) {
        return "Old and new addresses must differ";
      }
      return null;
    }
    if (!isValidEthAddress(state.primaryAddress)) return "Enter a valid address";
    const threshold = parseInt(state.threshold, 10);
    if (!Number.isFinite(threshold) || threshold < 1) {
      return "Threshold must be at least 1";
    }
    return null;
  }, [state]);

  const eligibleSafes = useMemo(() => {
    if (!operation) return [];
    return safes.map((safe) => {
      const reason = validateOwnerChangeForSafe(
        operation,
        safe.owners,
        safe.threshold
      );
      return { safe, reason };
    });
  }, [operation, safes]);

  const selectedSafes = useMemo(
    () =>
      eligibleSafes
        .filter((e) => !e.reason && state.selectedSafeIds.includes(e.safe.id))
        .map((e) => e.safe),
    [eligibleSafes, state.selectedSafeIds]
  );

  return {
    state,
    reset,
    setStep,
    setTemplate,
    patch,
    toggleSafe,
    selectAllEligible,
    operation,
    step2Error,
    eligibleSafes,
    selectedSafes,
  };
}
