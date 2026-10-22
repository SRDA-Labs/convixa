"use client";

import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/cn";

export type RosterRow = {
  id: string;
  signerAddress: string;
  displayName: string | null;
  signerType: string;
  roleLabel: string | null;
  hardwareWallet: string | null;
  isDedicatedSigner: boolean | null;
  verificationStatus: string;
  verificationMethod: string | null;
  source: string;
};

type Props = {
  safeId: string;
  roster: RosterRow[];
  canEdit: boolean;
  onUpdated?: () => void;
};

const TYPE_LABELS: Record<string, string> = {
  internal: "Internal",
  external_advisor: "External advisor",
  security_partner: "Security partner",
  unknown: "Unknown",
};

function statusBadge(status: string, method: string | null) {
  if (status === "verified" && method === "admin_attested") {
    return { label: "Attested", className: "bg-amber-500/10 text-amber-700" };
  }
  if (status === "verified") {
    return { label: "Verified", className: "bg-emerald-500/10 text-emerald-700" };
  }
  if (status === "pending") {
    return { label: "Pending", className: "bg-blue-500/10 text-blue-700" };
  }
  if (status === "expired") {
    return { label: "Expired", className: "bg-destructive/10 text-destructive" };
  }
  return { label: "Unverified", className: "bg-muted text-muted-foreground" };
}

export function SignerRosterTable({ safeId, roster, canEdit, onUpdated }: Props) {
  const [editing, setEditing] = useState<RosterRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState<string | null>(null);

  const refresh = () => {
    onUpdated?.();
    window.location.reload();
  };

  const saveEdit = async (row: RosterRow, form: FormData) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/safes/${safeId}/roster/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.get("displayName") || null,
          signerType: form.get("signerType"),
          roleLabel: form.get("roleLabel") || null,
          hardwareWallet: form.get("hardwareWallet") || null,
          isDedicatedSigner:
            form.get("isDedicatedSigner") === "true"
              ? true
              : form.get("isDedicatedSigner") === "false"
                ? false
                : null,
        }),
      });
      if (res.ok) {
        setEditing(null);
        refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const requestVerification = async (row: RosterRow, email?: string) => {
    setRequesting(row.id);
    try {
      await fetch(`/api/safes/${safeId}/roster/${row.id}/request-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(email ? { email } : {}),
      });
      refresh();
    } finally {
      setRequesting(null);
    }
  };

  if (roster.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No roster entries. Refresh the safe to sync on-chain owners.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Signer</th>
              <th className="px-3 py-2">Role / type</th>
              <th className="px-3 py-2">Hardware</th>
              <th className="px-3 py-2">Verification</th>
              {canEdit && <th className="px-3 py-2">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {roster.map((row) => {
              const badge = statusBadge(row.verificationStatus, row.verificationMethod);
              return (
                <tr key={row.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <p className="font-mono truncate max-w-[140px]">{row.signerAddress}</p>
                    {row.displayName && (
                      <p className="text-muted-foreground mt-0.5">{row.displayName}</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <p>{row.roleLabel ?? "—"}</p>
                    <p className="text-muted-foreground">{TYPE_LABELS[row.signerType] ?? row.signerType}</p>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.hardwareWallet ?? "—"}
                    {row.isDedicatedSigner === false && (
                      <span className="block text-amber-600">Non-dedicated</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", badge.className)}>
                      {badge.label}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing(row)}
                          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-muted/50"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </button>
                        {row.verificationStatus !== "verified" && (
                          <button
                            type="button"
                            disabled={requesting === row.id}
                            onClick={() => requestVerification(row)}
                            className="rounded border border-border px-2 py-1 hover:bg-muted/50 disabled:opacity-50"
                          >
                            {requesting === row.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Request verify"
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            className="w-full max-w-md rounded-xl border border-border bg-card p-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveEdit(editing, new FormData(e.currentTarget));
            }}
          >
            <h3 className="text-sm font-semibold">Edit signer roster</h3>
            <p className="font-mono text-xs text-muted-foreground truncate">{editing.signerAddress}</p>
            <input name="displayName" defaultValue={editing.displayName ?? ""} placeholder="Display name" className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs" />
            <select name="signerType" defaultValue={editing.signerType} className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs">
              <option value="unknown">Unknown</option>
              <option value="internal">Internal</option>
              <option value="external_advisor">External advisor</option>
              <option value="security_partner">Security partner</option>
            </select>
            <input name="roleLabel" defaultValue={editing.roleLabel ?? ""} placeholder="Role label (e.g. CTO)" className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs" />
            <select name="hardwareWallet" defaultValue={editing.hardwareWallet ?? ""} className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs">
              <option value="">Not set</option>
              <option value="ledger">Ledger</option>
              <option value="trezor">Trezor</option>
              <option value="gridplus">GridPlus</option>
              <option value="software">Software</option>
              <option value="unknown">Unknown</option>
            </select>
            <select name="isDedicatedSigner" defaultValue={editing.isDedicatedSigner === null ? "" : String(editing.isDedicatedSigner)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs">
              <option value="">Dedicated: not set</option>
              <option value="true">Dedicated signing wallet</option>
              <option value="false">Not dedicated</option>
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-border px-3 py-1.5 text-xs">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
