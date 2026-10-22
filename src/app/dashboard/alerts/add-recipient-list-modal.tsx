"use client";

import { useState, useCallback } from "react";
import { X, Loader2, Info, Mail, Trash2, UserPlus } from "lucide-react";

function initials(email: string): string {
  const parts = email.replace(/@.*/, "").split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts[0]?.length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function formatAddedAt(createdAt?: string): string {
  if (!createdAt) return "Just added";
  const d = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffM = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffM / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffM < 1) return "Just added";
  if (diffM < 60) return `Added ${diffM}m ago`;
  if (diffH < 24) return `Added ${diffH}h ago`;
  return `Added ${diffD}d ago`;
}

type PendingMember = { email: string; addedAt?: string };

type AddRecipientListModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddRecipientListModal({ open, onClose, onSuccess }: AddRecipientListModalProps) {
  const [groupName, setGroupName] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addEmail = useCallback(() => {
    const v = emailInput.trim().toLowerCase();
    if (!v || !v.includes("@")) return;
    if (pendingMembers.some((m) => m.email === v)) return;
    setPendingMembers((prev) => [...prev, { email: v }]);
    setEmailInput("");
  }, [emailInput, pendingMembers]);

  const removeEmail = useCallback((email: string) => {
    setPendingMembers((prev) => prev.filter((m) => m.email !== email));
  }, []);

  const reset = useCallback(() => {
    setGroupName("");
    setEmailInput("");
    setPendingMembers([]);
    setError("");
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!groupName.trim()) {
      setError("Group name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/alerts/subscription-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to create list");
        return;
      }
      const listId = data.list?.id;
      if (!listId) {
        setError("Invalid response");
        return;
      }
      for (const { email } of pendingMembers) {
        const addRes = await fetch(`/api/alerts/subscription-lists/${listId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (!addRes.ok) {
          setError("Failed to add some members");
          return;
        }
      }
      onSuccess();
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-xl bg-card rounded-xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-recipient-list-title"
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <UserPlus className="h-5 w-5" aria-hidden />
            </div>
            <h2 id="add-recipient-list-title" className="text-xl font-bold tracking-tight text-foreground">
              Add Recipient List
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="p-6 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  List Details
                </h3>
              </div>
              <div>
                <label htmlFor="recipient-list-group-name" className="block text-sm font-medium text-foreground mb-1.5">
                  Group Name
                </label>
                <input
                  id="recipient-list-group-name"
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter a descriptive name"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Manage Recipients
                </h3>
              </div>
              <div className="flex gap-3">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
                  placeholder="example.com"
                  className="flex-1 bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={addEmail}
                  className="px-5 py-2.5 bg-muted border border-border rounded-lg text-sm font-bold text-foreground hover:bg-muted/80 transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-muted/20">
                {pendingMembers.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No recipients yet. Add emails above.
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {pendingMembers.map((m) => (
                      <li
                        key={m.email}
                        className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-[10px] font-bold text-muted-foreground">
                            {initials(m.email)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{m.email}</p>
                            <p className="text-[10px] text-muted-foreground">{formatAddedAt(m.addedAt)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeEmail(m.email)}
                          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          aria-label={`Remove ${m.email}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-border flex items-center justify-end gap-4 bg-muted/30">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-primary text-primary-foreground px-8 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
              ) : null}
              Save List
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
