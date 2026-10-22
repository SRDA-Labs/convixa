"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface DeleteOrgButtonProps {
  orgId: string;
}

export function DeleteOrgButton({ orgId }: DeleteOrgButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/orgs/${orgId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Failed to delete organization."); setDeleting(false); return; }
      router.push("/login");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <>
      <ConfirmDialog
        open={showConfirm}
        onClose={() => { setShowConfirm(false); setError(""); }}
        title="Delete this organization?"
        description="This will permanently delete the organization and all associated data including Safes, teams, members, alerts, and policies. This action cannot be undone."
        confirmLabel="Delete Organization"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        destructive
        loading={deleting}
      />

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
      )}

      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
            <p className="text-xs text-muted-foreground">
              Permanently delete this organization and all its data. This action is irreversible.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete Organization
        </button>
      </div>
    </>
  );
}
