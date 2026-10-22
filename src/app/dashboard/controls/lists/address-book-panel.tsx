"use client";

import {
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Loader2, Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  DIRECTORY_LABEL_PLACEHOLDER,
  isDirectoryList,
  isWatchlist,
  isValidAddressListType,
  LIST_TYPE_DESCRIPTION,
  UNASSIGNED_TYPE_LABEL,
} from "@/lib/address-lists/constants";
import {
  parseDirectoryImport,
  parseTagsInput,
  parseWatchlistImport,
} from "@/lib/address-lists/parse-import";

import type { AddressListType } from "@/lib/db/schema/address-lists.schema";

export type AddressBookPanelRef = {
  hasPendingChanges: () => boolean;
  flushPending: () => Promise<void>;
};

type ListEntry = {
  id: string;
  listId: string;
  address: string;
  label: string | null;
  notes: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type AddressBookListDetail = {
  id: string;
  orgId: string;
  name: string;
  type: string;
  createdAt: string;
  createdByUserId: string | null;
  entries: ListEntry[];
};

type AddressBookPanelProps = {
  listId: string;
  prefilledAddress?: string;
  /** When set in manage modal, drives directory vs watchlist UI before save. */
  categoryType?: AddressListType | "";
  /** Hides category description and unset banners — shown in modal header instead. */
  embeddedInModal?: boolean;
  onUpdated?: () => void;
  onLoaded?: (list: AddressBookListDetail) => void;
  onPendingEditChange?: (pending: boolean) => void;
};

function truncateAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export const AddressBookPanel = forwardRef<AddressBookPanelRef, AddressBookPanelProps>(
  function AddressBookPanel({ listId, prefilledAddress = "", categoryType, embeddedInModal = false, onUpdated, onLoaded, onPendingEditChange }, ref) {
    const [list, setList] = useState<AddressBookListDetail | null>(null);
    const [loading, setLoading] = useState(true);

    const [contactLabel, setContactLabel] = useState("");
    const [contactAddress, setContactAddress] = useState("");
    const [contactNotes, setContactNotes] = useState("");
    const [contactTags, setContactTags] = useState("");
    const [bulkInput, setBulkInput] = useState("");
    const [showBulk, setShowBulk] = useState(false);

    const [addSubmitting, setAddSubmitting] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);
    const [addSuccess, setAddSuccess] = useState<string | null>(null);
    const [removeSubmitting, setRemoveSubmitting] = useState<string | null>(null);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editLabel, setEditLabel] = useState("");
    const [editNotes, setEditNotes] = useState("");
    const [editTags, setEditTags] = useState("");
    const [editSaving, setEditSaving] = useState(false);

    const fetchList = useCallback(async () => {
      if (!listId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/org/lists/${listId}`);
        if (!res.ok) {
          if (res.status === 404) setList(null);
          return;
        }
        const data = await res.json();
        const next = data.list ?? null;
        setList(next);
        if (next) onLoaded?.(next);
      } finally {
        setLoading(false);
      }
    }, [listId, onLoaded]);

    useEffect(() => {
      fetchList();
    }, [fetchList]);

    useEffect(() => {
      if (prefilledAddress && !contactAddress) {
        setContactAddress(prefilledAddress);
      }
    }, [prefilledAddress, contactAddress]);

    const effectiveType =
      categoryType !== undefined
        ? categoryType
        : list && isValidAddressListType(list.type)
          ? list.type
          : "";
    const directory = !!effectiveType && isDirectoryList(effectiveType);
    const watchlist = effectiveType === "watchlist";
    const typeUnset = !effectiveType;

    useEffect(() => {
      onPendingEditChange?.(editingId !== null);
    }, [editingId, onPendingEditChange]);

    async function saveEdit(entryId: string) {
      if (directory && !editLabel.trim()) {
        setAddError("Name is required.");
        return;
      }
      setEditSaving(true);
      setAddError(null);
      try {
        const res = await fetch(`/api/org/lists/${listId}/entries/${entryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: editLabel.trim() || null,
            notes: editNotes.trim() || null,
            tags: parseTagsInput(editTags),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setAddError(data.error ?? "Failed to save");
          return;
        }
        setEditingId(null);
        setAddSuccess("Contact updated");
        await fetchList();
        onUpdated?.();
      } finally {
        setEditSaving(false);
      }
    }

    useImperativeHandle(ref, () => ({
      hasPendingChanges: () => editingId !== null,
      flushPending: async () => {
        if (editingId) await saveEdit(editingId);
      },
    }));

    async function postEntries(
      entries: {
        address: string;
        label?: string;
        notes?: string;
        tags?: string[];
      }[]
    ) {
      const res = await fetch(`/api/org/lists/${listId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Failed to add");
        return null;
      }
      return data as { added: number; skipped?: number };
    }

    async function handleAddContact(e: React.FormEvent) {
      e.preventDefault();
      setAddError(null);
      setAddSuccess(null);
      if (!contactLabel.trim() || !contactAddress.trim()) {
        setAddError("Name and address are required.");
        return;
      }
      setAddSubmitting(true);
      try {
        const label = contactLabel.trim();
        const result = await postEntries([
          {
            address: contactAddress.trim(),
            label,
            notes: contactNotes.trim() || undefined,
            tags: parseTagsInput(contactTags),
          },
        ]);
        if (!result) return;
        if (result.added === 0) {
          setAddError("Address already exists in this list.");
          return;
        }
        setContactLabel("");
        setContactAddress("");
        setContactNotes("");
        setContactTags("");
        setAddSuccess(`Added ${label}`);
        await fetchList();
        onUpdated?.();
      } finally {
        setAddSubmitting(false);
      }
    }

    async function handleBulkAdd(e: React.FormEvent) {
      e.preventDefault();
      setAddError(null);
      setAddSuccess(null);
      const raw = bulkInput.trim();
      if (!raw) return;

      const entries = directory
        ? parseDirectoryImport(raw).map((e) => ({
            address: e.address,
            label: e.label,
            notes: e.notes,
          }))
        : parseWatchlistImport(raw).map((e) => ({ address: e.address }));

      if (entries.length === 0) {
        setAddError(
          directory
            ? "No valid lines. Use one per line: Name,0x… or 0x… only."
            : "Enter one or more Ethereum addresses."
        );
        return;
      }

      setAddSubmitting(true);
      try {
        const result = await postEntries(entries);
        if (!result) return;
        setBulkInput("");
        setShowBulk(false);
        const skipped = result.skipped ?? 0;
        setAddSuccess(
          `Added ${result.added} entr${result.added === 1 ? "y" : "ies"}` +
            (skipped > 0 ? ` (${skipped} duplicate${skipped === 1 ? "" : "s"} skipped)` : "")
        );
        await fetchList();
        onUpdated?.();
      } finally {
        setAddSubmitting(false);
      }
    }

    async function handleRemove(entryId: string, address: string) {
      setRemoveSubmitting(entryId);
      try {
        const res = await fetch(`/api/org/lists/${listId}/entries`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addresses: [address] }),
        });
        if (res.ok) {
          if (editingId === entryId) setEditingId(null);
          await fetchList();
          onUpdated?.();
        }
      } finally {
        setRemoveSubmitting(null);
      }
    }

    function startEdit(entry: ListEntry) {
      setEditingId(entry.id);
      setEditLabel(entry.label ?? "");
      setEditNotes(entry.notes ?? "");
      setEditTags((entry.tags ?? []).join(", "));
      setAddError(null);
      setAddSuccess(null);
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center gap-2 text-muted-foreground py-12">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading…
        </div>
      );
    }

    if (!list) {
      return <p className="text-sm text-muted-foreground py-6">Address book not found.</p>;
    }

    const typeDescription =
      effectiveType && LIST_TYPE_DESCRIPTION[effectiveType as AddressListType]
        ? LIST_TYPE_DESCRIPTION[effectiveType as AddressListType]
        : "";

    return (
      <div className={cn("space-y-5", embeddedInModal && "space-y-6")}>
        {typeUnset && !embeddedInModal && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs">
            <p className="font-medium text-foreground">{UNASSIGNED_TYPE_LABEL}</p>
            <p className="mt-0.5 text-muted-foreground">
              Select an address book category above (vendor, sponsor, token, or watchlist), then save.
            </p>
          </div>
        )}
        {typeDescription && !typeUnset && !embeddedInModal && (
          <p className="text-xs text-muted-foreground">{typeDescription}</p>
        )}

        {prefilledAddress && directory && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-xs">
            <p className="font-medium text-foreground">Add this destination as a named contact</p>
            <p className="mt-1 font-mono text-muted-foreground break-all">{prefilledAddress}</p>
          </div>
        )}

        {!typeUnset && directory ? (
          <div
            className={cn(
              "rounded-xl border border-border/80 bg-muted/20 p-4 space-y-4",
              embeddedInModal && "p-5"
            )}
          >
            <h3 className="text-sm font-semibold text-foreground">Add contact</h3>
            <form onSubmit={handleAddContact} className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Name *</label>
                <input
                  type="text"
                  value={contactLabel}
                  onChange={(e) => setContactLabel(e.target.value)}
                  placeholder={
                    DIRECTORY_LABEL_PLACEHOLDER[
                      effectiveType as keyof typeof DIRECTORY_LABEL_PLACEHOLDER
                    ] ?? "Contact name"
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  disabled={addSubmitting}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Address *</label>
                <input
                  type="text"
                  value={contactAddress}
                  onChange={(e) => setContactAddress(e.target.value)}
                  placeholder="0x…"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                  disabled={addSubmitting}
                />
              </div>
              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="submit"
                  disabled={addSubmitting || !contactLabel.trim() || !contactAddress.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {addSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add contact
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulk((v) => !v)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {showBulk ? "Hide bulk import" : "Bulk import"}
                </button>
              </div>
            </form>
          </div>
        ) : !typeUnset ? (
          <div
            className={cn(
              "rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3",
              embeddedInModal && "p-5"
            )}
          >
            <h3 className="text-sm font-semibold text-foreground">Add addresses</h3>
            <form onSubmit={handleBulkAdd} className="flex flex-wrap gap-3 items-end">
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="0x… one per line"
                rows={3}
                className="flex-1 min-w-[200px] rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                disabled={addSubmitting}
              />
              <button
                type="submit"
                disabled={addSubmitting || !bulkInput.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {addSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </button>
            </form>
          </div>
        ) : null}

        {directory && showBulk && !typeUnset && (
          <form onSubmit={handleBulkAdd} className="rounded-xl border border-dashed border-border/80 p-4 space-y-3">
            <label className="block text-xs font-medium text-muted-foreground">Name,0x… per line</label>
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border px-2.5 py-1.5 text-sm font-mono"
              disabled={addSubmitting}
            />
            <button
              type="submit"
              disabled={addSubmitting || !bulkInput.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              Import
            </button>
          </form>
        )}

        {addError && <p className="text-xs text-destructive">{addError}</p>}
        {addSuccess && <p className="text-xs text-emerald-700 dark:text-emerald-400">{addSuccess}</p>}

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            {directory ? "Contacts" : "Addresses"}
            <span className="ml-1.5 font-normal text-muted-foreground">({list.entries.length})</span>
          </h3>
          {list.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No entries yet.</p>
          ) : (
            <div
              className={cn(
                "rounded-xl border border-border/80 overflow-hidden overflow-y-auto",
                embeddedInModal ? "max-h-[280px]" : "max-h-[240px]"
              )}
            >
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    {directory && (
                      <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Name</th>
                    )}
                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Address</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground w-20 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/80">
                  {list.entries.map((entry) => {
                    const isEditing = editingId === entry.id;
                    return (
                      <tr key={entry.id} className="align-top hover:bg-muted/20">
                        {directory && (
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <input
                                value={editLabel}
                                onChange={(e) => setEditLabel(e.target.value)}
                                className="w-full rounded border border-border px-1.5 py-0.5 text-xs"
                              />
                            ) : (
                              <span className="font-medium">{entry.label ?? "—"}</span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3 font-mono text-xs" title={entry.address}>
                          {watchlist ? entry.address : truncateAddr(entry.address)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {directory &&
                              (isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => saveEdit(entry.id)}
                                    disabled={editSaving}
                                    className="p-1 text-emerald-600"
                                    aria-label="Save row"
                                  >
                                    {editSaving ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(null)}
                                    className="p-1 text-muted-foreground"
                                    aria-label="Cancel"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEdit(entry)}
                                  className="p-1 text-muted-foreground hover:text-foreground"
                                  aria-label="Edit"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              ))}
                            <button
                              type="button"
                              onClick={() => handleRemove(entry.id, entry.address)}
                              disabled={removeSubmitting === entry.id}
                              className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
                              aria-label="Remove"
                            >
                              {removeSubmitting === entry.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }
);
