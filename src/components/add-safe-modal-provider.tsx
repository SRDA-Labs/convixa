"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { AddSafeModal } from "./add-safe-modal";

export type AddSafeInitialValues = {
  address?: string;
  network?: string;
  name?: string;
} | null;

type AddSafeModalContextValue = {
  open: boolean;
  setOpen: (open: boolean, initialValues?: AddSafeInitialValues) => void;
};

const AddSafeModalContext = createContext<AddSafeModalContextValue | null>(null);

export function useAddSafeModal() {
  const ctx = useContext(AddSafeModalContext);
  if (!ctx) return null;
  return ctx;
}

export function AddSafeModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpenState] = useState(false);
  const [initialValues, setInitialValues] = useState<AddSafeInitialValues>(null);

  const setOpen = useCallback((nextOpen: boolean, nextInitialValues?: AddSafeInitialValues) => {
    setOpenState(nextOpen);
    if (!nextOpen) {
      setInitialValues(null);
    } else {
      setInitialValues(nextInitialValues ?? null);
    }
  }, []);

  const onClose = useCallback(() => {
    setOpenState(false);
    setInitialValues(null);
  }, []);

  return (
    <AddSafeModalContext.Provider value={{ open, setOpen }}>
      {children}
      <AddSafeModal open={open} onClose={onClose} initialValues={initialValues} />
    </AddSafeModalContext.Provider>
  );
}
