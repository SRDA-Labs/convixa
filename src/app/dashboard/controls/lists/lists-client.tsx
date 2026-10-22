"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  List,
  Pencil,
  Trash2,
  Building2,
  Star,
  Coins,
  ChevronLeft,
  ChevronRight,
  ListIcon,
  MapPin,
  LayoutGrid,
  Eye,
  Bell,
  BookUser,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { UNASSIGNED_TYPE_LABEL } from "@/lib/address-lists/constants";
import { CreateListModal } from "./create-list-modal";
import { ManageListModal, type ManageListTarget } from "./manage-list-modal";

const PAGE_SIZE = 10;

type UnifiedListKind = "alert_subscription" | "onchain_address_book";

type UnifiedListSummary = {
  id: string;
  kind: UnifiedListKind;
  name: string;
  kindLabel: string;
  subType: string | null;
  subTypeLabel: string;
  typeAssigned: boolean;
  createdAt: string;
  createdByUserId: string | null;
  createdByName: string | null;
  entryCount: number;
  entryPreview: string[];
};

function getListIcon(kind: UnifiedListKind, subType: string | null) {
  if (kind === "alert_subscription") {
    return <Bell className="h-5 w-5 text-blue-500" aria-hidden />;
  }
  switch (subType) {
    case "vendors":
      return <Building2 className="h-5 w-5 text-primary" aria-hidden />;
    case "sponsors":
      return <Star className="h-5 w-5 text-blue-500" aria-hidden />;
    case "token_contracts":
      return <Coins className="h-5 w-5 text-emerald-500" aria-hidden />;
    case "watchlist":
      return <Eye className="h-5 w-5 text-amber-500" aria-hidden />;
    default:
      return <BookUser className="h-5 w-5 text-primary" aria-hidden />;
  }
}

function getListIconBg(kind: UnifiedListKind, subType: string | null) {
  if (kind === "alert_subscription") return "bg-blue-500/10 text-blue-500";
  switch (subType) {
    case "vendors":
      return "bg-primary/10 text-primary";
    case "sponsors":
      return "bg-blue-500/10 text-blue-500";
    case "token_contracts":
      return "bg-emerald-500/10 text-emerald-500";
    case "watchlist":
      return "bg-amber-500/10 text-amber-500";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatDate(createdAt: string): string {
  const d = new Date(createdAt);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function entryPrefix(text: string): string {
  const clean = text.replace(/^0x/i, "").replace(/@.*/, "").slice(0, 2).toUpperCase();
  return clean || "•";
}

export function ListsClient() {
  const searchParams = useSearchParams();
  const addAddress = searchParams.get("addAddress")?.trim() ?? null;

  const [lists, setLists] = useState<UnifiedListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [manageList, setManageList] = useState<ManageListTarget | null>(null);
  const [page, setPage] = useState(1);

  function openManage(list: UnifiedListSummary) {
    setManageList({
      id: list.id,
      kind: list.kind,
      name: list.name,
      kindLabel: list.kindLabel,
      subType: list.subType,
      subTypeLabel: list.subTypeLabel,
      typeAssigned: list.typeAssigned,
    });
  }

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/org/unified-lists");
      if (!res.ok) return;
      const data = await res.json();
      setLists(data.lists ?? []);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const addressBooks = useMemo(
    () => lists.filter((l) => l.kind === "onchain_address_book"),
    [lists]
  );
  const subscriptionLists = useMemo(
    () => lists.filter((l) => l.kind === "alert_subscription"),
    [lists]
  );
  const totalEntries = useMemo(() => lists.reduce((s, l) => s + l.entryCount, 0), [lists]);
  const thisWeek = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return lists.filter((l) => new Date(l.createdAt) >= cutoff).length;
  }, [lists]);

  const sortedLists = useMemo(
    () => [...lists].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [lists]
  );
  const paginatedLists = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedLists.slice(start, start + PAGE_SIZE);
  }, [sortedLists, page]);
  const totalPages = Math.max(1, Math.ceil(sortedLists.length / PAGE_SIZE));
  const from = sortedLists.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, sortedLists.length);

  async function handleDelete(list: UnifiedListSummary) {
    const label =
      list.kind === "alert_subscription" ? "subscription list" : "address book";
    if (!confirm(`Delete this ${label}?`)) return;
    const url =
      list.kind === "alert_subscription"
        ? `/api/alerts/subscription-lists/${list.id}`
        : `/api/org/lists/${list.id}`;
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) await fetchLists();
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Lists</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Two list types: <strong className="font-medium text-foreground">Alert subscription lists</strong>{" "}
            (org members for alert emails) and{" "}
            <strong className="font-medium text-foreground">On-chain address books</strong> (named Web3
            vendors and counterparties).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground",
            "shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98]"
          )}
        >
          <Plus className="h-5 w-5" aria-hidden />
          Create list
        </button>
      </div>

      {addAddress && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">Add destination to an on-chain address book</p>
          <p className="mt-1 text-xs text-muted-foreground font-mono break-all">{addAddress}</p>
          {addressBooks.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Click <strong>Manage</strong> on a vendor directory below to add this address with a name, then
              re-open the signer checklist.
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Create an <strong>on-chain address book</strong> (e.g. vendors) and add this destination with a
              recognizable name.
            </p>
          )}
        </div>
      )}

      {!loading && lists.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl border border-border bg-card p-6 relative overflow-hidden">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
              Total lists
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-foreground">{lists.length}</span>
              {thisWeek > 0 && (
                <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  +{thisWeek} this week
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {subscriptionLists.length} alert · {addressBooks.length} address book
            </p>
            <List className="absolute -right-4 -bottom-4 h-20 w-20 text-muted-foreground/10 pointer-events-none" />
          </div>
          <div className="rounded-xl border border-border bg-card p-6 relative overflow-hidden">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
              Total entries
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-foreground">{totalEntries.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">members &amp; addresses</span>
            </div>
            <MapPin className="absolute -right-4 -bottom-4 h-20 w-20 text-muted-foreground/10 pointer-events-none" />
          </div>
          <div className="rounded-xl border border-border bg-card p-6 relative overflow-hidden">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
              By type
            </p>
            <p className="text-sm text-foreground/90">
              <span className="font-medium">Alert:</span> {subscriptionLists.length}
              <span className="text-muted-foreground mx-2">·</span>
              <span className="font-medium">Address book:</span> {addressBooks.length}
            </p>
            <LayoutGrid className="absolute -right-4 -bottom-4 h-20 w-20 text-muted-foreground/10 pointer-events-none" />
          </div>
        </div>
      )}

      <CreateListModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={fetchLists}
        onOpenManage={(target) => {
          setCreateOpen(false);
          setManageList(target);
        }}
      />

      <ManageListModal
        list={manageList}
        prefilledAddress={
          manageList?.kind === "onchain_address_book" ? addAddress : null
        }
        onClose={() => setManageList(null)}
        onUpdated={fetchLists}
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading lists…</p>
      ) : lists.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 py-12 px-6 text-center">
          <List className="mx-auto h-12 w-12 text-muted-foreground/60" aria-hidden />
          <p className="mt-4 text-sm font-medium text-foreground">No lists yet</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            Create an alert subscription list for your team, or an on-chain address book for vendors and
            counterparties.
          </p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Create list
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Name, kind &amp; category
                </th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Preview
                </th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Created
                </th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedLists.map((list) => (
                <tr key={`${list.kind}-${list.id}`} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                          getListIconBg(list.kind, list.subType)
                        )}
                      >
                        {getListIcon(list.kind, list.subType)}
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => openManage(list)}
                          className="text-sm font-bold text-primary hover:underline block truncate text-left"
                        >
                          {list.name}
                        </button>
                        <p className="text-[10px] font-medium">
                          <span className="text-foreground/90">{list.kindLabel}</span>
                          {list.kind === "onchain_address_book" && (
                            <>
                              <span className="text-muted-foreground/70"> · </span>
                              <span
                                className={
                                  list.typeAssigned
                                    ? "text-muted-foreground"
                                    : "text-amber-700 dark:text-amber-400"
                                }
                              >
                                {list.typeAssigned ? list.subTypeLabel : UNASSIGNED_TYPE_LABEL}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {(list.entryPreview ?? []).slice(0, 3).map((entry, i) => (
                          <div
                            key={`${list.id}-${i}-${entry}`}
                            className="w-7 h-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold text-foreground shrink-0"
                            title={entry}
                          >
                            {entryPrefix(entry)}
                          </div>
                        ))}
                      </div>
                      <span className="text-xs font-medium text-muted-foreground ml-1">
                        {list.entryCount}{" "}
                        {list.kind === "alert_subscription"
                          ? list.entryCount === 1
                            ? "recipient"
                            : "recipients"
                          : list.entryCount === 1
                            ? "entry"
                            : "entries"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-xs font-medium text-foreground">{formatDate(list.createdAt)}</p>
                    {list.createdByName && (
                      <p className="text-[10px] text-muted-foreground italic">by {list.createdByName}</p>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => openManage(list)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Pencil className="h-4 w-4" /> Manage
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(list)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/20">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Showing {from}-{to} of {sortedLists.length} lists
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded border border-border text-muted-foreground hover:bg-muted disabled:opacity-30"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded border border-border text-muted-foreground hover:bg-muted disabled:opacity-30"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
