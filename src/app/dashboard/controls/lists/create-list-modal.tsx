"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Bell, BookUser, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  ADDRESS_LIST_TYPES,
  type AddressListType,
} from "@/lib/db/schema/address-lists.schema";
import {
  LIST_CREATION_KIND_DESCRIPTION,
  LIST_CREATION_KIND_LABEL,
  LIST_TYPE_DESCRIPTION,
  LIST_TYPE_LABEL,
  type ListCreationKind,
} from "@/lib/address-lists/constants";
import type { ManageListTarget } from "./manage-list-modal";

type OrgMember = {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  roleName: string | null;
};

type CreateListModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  onOpenManage?: (list: ManageListTarget) => void;
};

export function CreateListModal({ open, onClose, onCreated, onOpenManage }: CreateListModalProps) {
  const [kind, setKind] = useState<ListCreationKind | null>(null);
  const [name, setName] = useState("");
  const [addressBookType, setAddressBookType] = useState<AddressListType>("vendors");
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersForbidden, setMembersForbidden] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setKind(null);
    setName("");
    setAddressBookType("vendors");
    setSelectedEmails(new Set());
    setError(null);
    setMembersForbidden(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  useEffect(() => {
    if (!open || kind !== "alert_subscription") return;
    setMembersLoading(true);
    fetch("/api/members")
      .then(async (res) => {
        if (res.status === 403) {
          setMembersForbidden(true);
          setOrgMembers([]);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setOrgMembers(data.members ?? []);
      })
      .finally(() => setMembersLoading(false));
  }, [open, kind]);

  function toggleEmail(email: string) {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  function selectAllMembers() {
    setSelectedEmails(new Set(orgMembers.map((m) => m.email)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kind || !name.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      if (kind === "onchain_address_book") {
        const res = await fetch("/api/org/lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), type: addressBookType }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to create address book");
          return;
        }
        const listId = data.list?.id;
        handleClose();
        onCreated();
        if (listId) {
          onOpenManage?.({
            id: listId,
            kind: "onchain_address_book",
            name: name.trim(),
            kindLabel: LIST_CREATION_KIND_LABEL.onchain_address_book,
            subType: addressBookType,
            subTypeLabel: LIST_TYPE_LABEL[addressBookType],
            typeAssigned: true,
          });
        }
        return;
      }

      const res = await fetch("/api/alerts/subscription-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create subscription list");
        return;
      }
      const listId = data.list?.id as string | undefined;
      if (listId && selectedEmails.size > 0) {
        for (const email of selectedEmails) {
          const addRes = await fetch(`/api/alerts/subscription-lists/${listId}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          if (!addRes.ok) {
            setError("List created but some members could not be added.");
            break;
          }
        }
      }
      handleClose();
      onCreated();
      if (listId) {
        onOpenManage?.({
          id: listId,
          kind: "alert_subscription",
          name: name.trim(),
          kindLabel: LIST_CREATION_KIND_LABEL.alert_subscription,
          subType: "alert_subscription",
          subTypeLabel: "Alert recipients",
          typeAssigned: true,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-[8px] bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-list-title"
    >
      <div className="w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 id="create-list-title" className="text-lg font-semibold text-foreground">
            Create list
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="p-6 space-y-6 overflow-y-auto">
            {!kind ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">What kind of list do you need?</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      {
                        id: "alert_subscription" as const,
                        icon: Bell,
                        color: "text-blue-500",
                        bg: "bg-blue-500/10",
                      },
                      {
                        id: "onchain_address_book" as const,
                        icon: BookUser,
                        color: "text-primary",
                        bg: "bg-primary/10",
                      },
                    ] as const
                  ).map(({ id, icon: Icon, color, bg }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setKind(id)}
                      className={cn(
                        "rounded-xl border border-border p-4 text-left hover:border-primary/40 hover:bg-muted/30 transition-colors",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      )}
                    >
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-3", bg)}>
                        <Icon className={cn("h-5 w-5", color)} />
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {LIST_CREATION_KIND_LABEL[id]}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {LIST_CREATION_KIND_DESCRIPTION[id]}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setKind(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ← Change list type
                </button>

                <div>
                  <label htmlFor="list-name" className="block text-xs font-medium text-muted-foreground mb-1">
                    List name
                  </label>
                  <input
                    id="list-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      kind === "alert_subscription"
                        ? "e.g. Treasury on-call"
                        : "e.g. SaaS vendors"
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    required
                  />
                </div>

                {kind === "onchain_address_book" && (
                  <div>
                    <label htmlFor="book-type" className="block text-xs font-medium text-muted-foreground mb-1">
                      Address book category
                    </label>
                    <div className="relative">
                      <select
                        id="book-type"
                        value={addressBookType}
                        onChange={(e) => setAddressBookType(e.target.value as AddressListType)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm appearance-none pr-10"
                      >
                        {ADDRESS_LIST_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {LIST_TYPE_LABEL[type]}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {LIST_TYPE_DESCRIPTION[addressBookType]}
                    </p>
                  </div>
                )}

                {kind === "alert_subscription" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground">
                        Org members to notify
                      </label>
                      {orgMembers.length > 0 && (
                        <button
                          type="button"
                          onClick={selectAllMembers}
                          className="text-xs text-primary hover:underline"
                        >
                          Select all
                        </button>
                      )}
                    </div>
                    {membersLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading members…
                      </div>
                    ) : membersForbidden ? (
                      <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border p-3">
                        You can create the list now and add recipient emails on the next screen.
                      </p>
                    ) : orgMembers.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No org members found. Invite teammates first, or add emails after creating the list.
                      </p>
                    ) : (
                      <ul className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                        {orgMembers.map((m) => (
                          <li key={m.id}>
                            <label className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedEmails.has(m.email)}
                                onChange={() => toggleEmail(m.email)}
                                className="rounded"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {m.name ?? m.email}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {m.email}
                                  {m.roleName ? ` · ${m.roleName}` : ""}
                                </p>
                              </div>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Selected members receive emails when an alert rule with this subscription list fires.
                    </p>
                  </div>
                )}
              </>
            )}

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>

          {kind && (
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3 shrink-0 bg-muted/20">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !name.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create list
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
