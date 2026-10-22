"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Pencil,
  PenLine,
  Eye,
  BarChart2,
  Trash2,
  PlusCircle,
  Info,
  MoreHorizontal,
  X,
  Box,
  Users,
} from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PermissionMatrix } from "@/components/permission-matrix";

export type SystemRoleRow = {
  type: "system";
  id: string;
  name: string;
  description: string;
  memberCount: number;
  memberPreviews: { name: string | null; email: string }[];
};

export type CustomRoleRow = {
  type: "custom";
  id: string;
  orgId: string;
  name: string;
  slug: string;
  permissions: string[];
  description: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type RoleTableRow = SystemRoleRow | CustomRoleRow;
export type RoleRow = {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
};

function initials(name: string | null, email: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0]! + parts[parts.length - 1]![0]).toUpperCase();
    return (parts[0]!.slice(0, 2) || "?").toUpperCase();
  }
  const local = email.split("@")[0];
  if (local?.length >= 2) return local.slice(0, 2).toUpperCase();
  return "?";
}

function RoleIcon({ row }: { row: RoleTableRow }) {
  if (row.type === "system") {
    return (
      <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded shrink-0">
        <Shield className="h-5 w-5" aria-hidden />
      </div>
    );
  }
  const r = row as CustomRoleRow;
  const slug = r.slug.toLowerCase();
  if (slug.includes("signer")) {
    return (
      <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded shrink-0">
        <PenLine className="h-5 w-5" aria-hidden />
      </div>
    );
  }
  if (slug.includes("viewer")) {
    return (
      <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded shrink-0">
        <Eye className="h-5 w-5" aria-hidden />
      </div>
    );
  }
  if (slug.includes("auditor")) {
    return (
      <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded shrink-0">
        <BarChart2 className="h-5 w-5" aria-hidden />
      </div>
    );
  }
  return (
    <div className="p-2 bg-muted text-muted-foreground rounded shrink-0">
      <MoreHorizontal className="h-5 w-5" aria-hidden />
    </div>
  );
}

export function RolesList({
  orgId,
  initialRoles,
  tableRows,
  totalRoles,
  canCreate,
  canUpdate,
  canDelete,
  showCreateOnly,
}: {
  orgId: string;
  initialRoles: RoleRow[];
  tableRows: RoleTableRow[];
  totalRoles: number;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  showCreateOnly?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createPerms, setCreatePerms] = useState<string[]>([]);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const ANIMATION_MS = 200;

  const closeCreateModal = useCallback(() => {
    setShowCreate(false);
    setError("");
    setCreateName("");
    setCreateDescription("");
    setCreatePerms([]);
    setIsVisible(false);
    setIsClosing(false);
  }, []);

  const requestClose = useCallback(
    (afterClose?: () => void) => {
      if (isClosing) return;
      setIsClosing(true);
      setTimeout(() => {
        if (typeof afterClose === "function") afterClose();
        else closeCreateModal();
      }, ANIMATION_MS);
    },
    [isClosing, closeCreateModal]
  );

  useEffect(() => {
    if (showCreate) {
      setIsClosing(false);
      const t = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(t);
    }
  }, [showCreate]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const slug = createName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "") || "custom-role";
    startTransition(async () => {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim(), slug, permissions: createPerms }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to create role");
        return;
      }
      requestClose(() => {
        closeCreateModal();
        router.refresh();
      });
    });
  }

  function openEdit(r: RoleRow) {
    setEditingId(r.id);
    setEditName(r.name);
    setEditSlug(r.slug);
    setEditPerms(r.permissions ?? []);
    setError("");
  }

  async function handleUpdate(e: React.FormEvent, id: string) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/roles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, slug: editSlug, permissions: editPerms }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to update role");
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function handleDeleteClick(id: string) {
    setDeleteConfirmId(id);
  }

  async function handleDeleteConfirm() {
    const id = deleteConfirmId;
    if (!id) return;
    setError("");
    const res = await fetch(`/api/roles/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to delete role");
      return;
    }
    setEditingId(null);
    setDeleteConfirmId(null);
    router.refresh();
  }

  const show = showCreate && isVisible && !isClosing;

  const createRoleModal = showCreate && (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${show ? "opacity-100" : "opacity-0"} ${isClosing ? "pointer-events-none" : ""}`}
      aria-modal="true"
      role="dialog"
      onClick={() => requestClose()}
    >
      <div
        className={`w-full max-w-3xl rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col max-h-[90vh] transition-all duration-200 ease-out ${show ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-zinc-800 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-base font-bold tracking-tight text-white uppercase">Create new role</h3>
            <p className="text-sm text-zinc-400 mt-1">Configure role identity and access permissions.</p>
          </div>
          <button
            type="button"
            onClick={() => requestClose()}
            className="rounded p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Role name</label>
                  <input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    required
                    placeholder="e.g. Finance Admin"
                    className="w-full rounded border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Description</label>
                  <textarea
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    placeholder="Describe the responsibilities of this role..."
                    rows={2}
                    className="w-full rounded border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-transparent transition-all resize-none"
                  />
                </div>
              </div>
              <hr className="border-zinc-800" />
              <div className="space-y-3 pb-4">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-zinc-400">Permissions matrix</label>
                  <span className="text-[10px] text-zinc-500 shrink-0">
                    Hover <Info className="inline h-3 w-3 align-text-bottom" aria-hidden /> for each cell
                  </span>
                </div>
                <PermissionMatrix
                  selected={createPerms}
                  onChange={setCreatePerms}
                  variant="modal"
                />
              </div>
            </div>
          </div>
          {error && <div className="px-5"><p className="text-sm text-red-400" role="alert">{error}</p></div>}
          <div className="px-5 py-4 border-t border-zinc-800 flex items-center justify-end gap-3 shrink-0 bg-zinc-950">
            <button
              type="button"
              onClick={() => requestClose()}
              className="rounded border border-zinc-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground uppercase tracking-wider hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              {isPending ? "Saving…" : "Save role"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderPortal = () => {
    if (!showCreate || typeof document === "undefined") return null;
    return createPortal(createRoleModal, document.body);
  };

  if (showCreateOnly) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all btn-primary-glow"
        >
          <PlusCircle className="h-[18px] w-[18px]" aria-hidden />
          Create Role
        </button>
        {renderPortal()}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete this role?"
        description="Members with this role will have no custom permissions."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        destructive
      />
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          System Roles
          <span className="bg-muted text-muted-foreground text-[10px] px-2 py-0.5 rounded-full border border-border font-bold">
            {totalRoles}
          </span>
        </h3>
        {canCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all btn-primary-glow"
          >
            <PlusCircle className="h-[18px] w-[18px]" aria-hidden />
            Create Role
          </button>
        )}
      </div>

      {renderPortal()}

      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/20 border-b border-border">
            <tr>
              <th className="px-6 py-4 font-semibold text-muted-foreground uppercase text-[10px] tracking-widest w-1/4">
                Role Name
              </th>
              <th className="px-6 py-4 font-semibold text-muted-foreground uppercase text-[10px] tracking-widest w-2/4">
                Description
              </th>
              <th className="px-6 py-4 font-semibold text-muted-foreground uppercase text-[10px] tracking-widest text-center">
                Assigned Members
              </th>
              <th className="px-6 py-4 font-semibold text-muted-foreground uppercase text-[10px] tracking-widest text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tableRows.map((row) => {
              if (editingId && row.type === "custom" && row.id === editingId) {
                const r = row as CustomRoleRow;
                return (
                  <tr key={r.id} className="bg-muted/5">
                    <td colSpan={4} className="px-6 py-4">
                      <form onSubmit={(e) => handleUpdate(e, r.id)} className="space-y-3">
                        <div className="flex gap-3 flex-wrap">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            required
                            placeholder="Name"
                            className="rounded border border-border bg-muted/30 px-2 py-1 text-sm w-40"
                          />
                          <input
                            value={editSlug}
                            onChange={(e) => setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                            required
                            placeholder="Slug"
                            className="rounded border border-border bg-muted/30 px-2 py-1 text-sm w-32 font-mono"
                          />
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] text-muted-foreground">
                            Check cells to grant access. Use <Info className="inline h-3 w-3 align-text-bottom" aria-hidden /> for details.
                          </p>
                          <PermissionMatrix
                            selected={editPerms}
                            onChange={setEditPerms}
                            disabled={!canUpdate}
                          />
                        </div>
                        {error && <p className="text-sm text-destructive">{error}</p>}
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={isPending}
                            className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingId(null); setError(""); }}
                            className="rounded border border-border px-3 py-1 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={row.id} className="hover:bg-muted/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <RoleIcon row={row} />
                      <div>
                        <p className="font-semibold text-foreground">{row.name}</p>
                        <p
                          className={
                            row.type === "system"
                              ? "text-[11px] text-primary font-bold uppercase"
                              : "text-[11px] text-muted-foreground font-bold uppercase"
                          }
                        >
                          {row.type === "system" ? "System Role" : "Custom Role"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{row.description}</td>
                  <td className="px-6 py-4 text-center">
                    {row.type === "system" ? (
                      (row as SystemRoleRow).memberCount > 0 ? (
                        <div className="flex items-center justify-center -space-x-2">
                          {(row as SystemRoleRow).memberPreviews.slice(0, 3).map((m, i) => (
                            <div
                              key={i}
                              className="w-8 h-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-bold text-foreground overflow-hidden"
                            >
                              {initials(m.name, m.email)}
                            </div>
                          ))}
                          {(row as SystemRoleRow).memberCount > 3 && (
                            <div className="w-8 h-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                              +{(row as SystemRoleRow).memberCount - 3}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="bg-muted border border-border px-2.5 py-1 rounded text-xs font-medium text-muted-foreground">
                          0 Members
                        </span>
                      )
                    ) : (
                      <span className="bg-muted border border-border px-2.5 py-1 rounded text-xs font-medium text-muted-foreground">
                        {(row as CustomRoleRow).memberCount} Member{(row as CustomRoleRow).memberCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {row.type === "system" ? (
                        <button
                          type="button"
                          className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors cursor-not-allowed opacity-60"
                          title="System role cannot be edited"
                          disabled
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                      ) : canUpdate ? (
                        <button
                          type="button"
                          onClick={() => openEdit(row as CustomRoleRow)}
                          className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Edit role"
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                      ) : null}
                      {row.type === "system" ? (
                        <button
                          type="button"
                          className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors cursor-not-allowed opacity-60"
                          title="System role cannot be deleted"
                          disabled
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      ) : canDelete ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(row.id)}
                          className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Delete role"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="bg-muted/20 px-6 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {totalRoles} of {totalRoles} active roles</span>
          <div className="flex gap-4">
            <Link href="/dashboard" className="hover:text-primary transition-colors">
              Export CSV
            </Link>
            <Link href="/dashboard/audit" className="hover:text-primary transition-colors">
              Audit Logs
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-gradient-to-br from-muted/30 to-muted/50 p-6 flex items-center gap-6">
        <div className="w-12 h-12 bg-primary/20 text-primary rounded-full flex items-center justify-center shrink-0">
          <Info className="h-7 w-7" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-foreground">Managing Permissions</h4>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Use the permissions matrix when creating or editing a role. Rows match product areas; columns are
            view, create, edit, and delete. The <Info className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> icon on each cell explains that permission briefly.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-primary hover:underline shrink-0"
        >
          Learn more
        </Link>
      </div>
    </div>
  );
}
