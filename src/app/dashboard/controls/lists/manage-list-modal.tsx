"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Loader2, Bell, BookUser } from "lucide-react";
import { cn } from "@/lib/cn";
import type { AddressListType } from "@/lib/db/schema/address-lists.schema";
import { ADDRESS_LIST_TYPES } from "@/lib/db/schema/address-lists.schema";
import {
  LIST_TYPE_LABEL,
  UNASSIGNED_TYPE_LABEL,
  isValidAddressListType,
} from "@/lib/address-lists/constants";
import { AddressBookPanel, type AddressBookPanelRef, type AddressBookListDetail } from "./address-book-panel";
import { SubscriptionListPanel } from "./subscription-list-panel";

type UnifiedListKind = "alert_subscription" | "onchain_address_book";

export type ManageListTarget = {
  id: string;
  kind: UnifiedListKind;
  name: string;
  kindLabel: string;
  subType: string | null;
  subTypeLabel: string;
  typeAssigned: boolean;
};

type ManageListModalProps = {
  list: ManageListTarget | null;
  prefilledAddress?: string | null;
  onClose: () => void;
  onUpdated: () => void;
};

export function ManageListModal({
  list,
  prefilledAddress,
  onClose,
  onUpdated,
}: ManageListModalProps) {
  const addressBookRef = useRef<AddressBookPanelRef>(null);
  const [listName, setListName] = useState("");
  const [initialName, setInitialName] = useState("");
  const [addressBookType, setAddressBookType] = useState<AddressListType | "">("");
  const [initialAddressBookType, setInitialAddressBookType] = useState<AddressListType | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRowEdit, setPendingRowEdit] = useState(false);

  useEffect(() => {
    if (!list) return;
    setListName(list.name);
    setInitialName(list.name);
    const resolvedType = isValidAddressListType(list.subType) ? list.subType : "";
    setAddressBookType(resolvedType);
    setInitialAddressBookType(resolvedType);
    setError(null);
    setPendingRowEdit(false);
  }, [list]);

  useEffect(() => {
    if (!list) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list, onClose]);

  const handleAddressBookLoaded = useCallback((loaded: AddressBookListDetail) => {
    setListName(loaded.name);
    setInitialName(loaded.name);
    const resolvedType = isValidAddressListType(loaded.type) ? loaded.type : "";
    setAddressBookType(resolvedType);
    setInitialAddressBookType(resolvedType);
  }, []);

  const handleSubscriptionLoaded = useCallback((loaded: { name: string }) => {
    setListName(loaded.name);
    setInitialName(loaded.name);
  }, []);

  const nameDirty = listName.trim() !== initialName.trim();
  const typeDirty =
    list?.kind === "onchain_address_book" && addressBookType !== initialAddressBookType;
  const hasChanges = nameDirty || typeDirty || pendingRowEdit;
  const typeUnset = list?.kind === "onchain_address_book" && !addressBookType;

  async function handleSave() {
    if (!list) return;
    if (!hasChanges) {
      onClose();
      return;
    }
    if (typeDirty && !addressBookType) {
      setError("Select an address book category before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (list.kind === "onchain_address_book") {
        await addressBookRef.current?.flushPending();
      }

      const patchBody: { name?: string; type?: AddressListType } = {};
      if (nameDirty && listName.trim()) patchBody.name = listName.trim();
      if (typeDirty && addressBookType) patchBody.type = addressBookType;

      if (Object.keys(patchBody).length > 0) {
        const url =
          list.kind === "alert_subscription"
            ? `/api/alerts/subscription-lists/${list.id}`
            : `/api/org/lists/${list.id}`;
        const res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to save list");
          return;
        }
      }

      onUpdated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!list) return null;

  const isAlert = list.kind === "alert_subscription";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl max-h-[min(92vh,760px)] flex flex-col rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-list-title"
      >
        {/* Title row */}
        <div className="flex items-center gap-4 px-6 pt-6 pb-4 shrink-0">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              isAlert ? "bg-blue-500/10" : "bg-primary/10"
            )}
          >
            {isAlert ? (
              <Bell className="h-5 w-5 text-blue-500" />
            ) : (
              <BookUser className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <label htmlFor="manage-list-name" className="sr-only">
              List name
            </label>
            <input
              id="manage-list-name"
              type="text"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              className="w-full text-lg font-semibold bg-transparent border-0 focus:outline-none focus:ring-0 px-0 truncate"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 shrink-0 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Metadata strip */}
        <div className="mx-6 mb-5 rounded-xl bg-muted/30 border border-border/60 px-4 py-3 shrink-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-muted-foreground shrink-0">Kind</span>
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium",
                  isAlert
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "bg-primary/10 text-primary"
                )}
              >
                {list.kindLabel}
              </span>
            </div>
            {!isAlert && (
              <div className="flex flex-col gap-1.5 sm:items-end sm:min-w-[220px]">
                <label htmlFor="manage-list-category" className="text-xs text-muted-foreground">
                  Category
                </label>
                <select
                  id="manage-list-category"
                  value={addressBookType}
                  onChange={(e) =>
                    setAddressBookType(e.target.value as AddressListType | "")
                  }
                  className={cn(
                    "w-full sm:w-auto min-w-[200px] rounded-lg border bg-background px-3 py-2 text-sm",
                    typeUnset
                      ? "border-amber-500/50 text-amber-700 dark:text-amber-400"
                      : "border-border text-foreground"
                  )}
                >
                  <option value="">{UNASSIGNED_TYPE_LABEL}</option>
                  {ADDRESS_LIST_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {LIST_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {typeUnset && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              Choose a category, then save — vendor, sponsor, token, or watchlist.
            </p>
          )}
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 pb-2 flex-1 min-h-0">
          {isAlert ? (
            <SubscriptionListPanel
              listId={list.id}
              onUpdated={onUpdated}
              onLoaded={handleSubscriptionLoaded}
            />
          ) : (
            <AddressBookPanel
              ref={addressBookRef}
              listId={list.id}
              prefilledAddress={prefilledAddress ?? undefined}
              categoryType={addressBookType}
              embeddedInModal
              onUpdated={onUpdated}
              onLoaded={handleAddressBookLoaded}
              onPendingEditChange={setPendingRowEdit}
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
          <p
            className={cn(
              "text-sm flex-1",
              error ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {error ?? (hasChanges ? "Unsaved changes" : "Entries save immediately when you add or remove them")}
          </p>
          <div className="flex gap-3 shrink-0 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 min-w-[120px] rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {hasChanges ? "Save changes" : "Done"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
