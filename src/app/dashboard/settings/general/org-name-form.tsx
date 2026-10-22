"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Check } from "lucide-react";

interface OrgNameFormProps {
  orgId: string;
  initialName: string;
}

export function OrgNameForm({ orgId, initialName }: OrgNameFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isDirty = name.trim() !== initialName;

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessage("Organization name cannot be empty.");
      setStatus("error");
      return;
    }
    if (!isDirty) return;

    setStatus("saving");
    setErrorMessage("");

    try {
      const res = await fetch(`/api/orgs/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? "Failed to save.");
      }
      setStatus("success");
      router.refresh();
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save.");
      setStatus("error");
    }
  }

  return (
    <section className="rounded-md border border-border/60 bg-card overflow-hidden shadow-sm">
      <div className="px-3.5 py-2.5 border-b border-border/40 flex items-center gap-2">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <div>
          <h3 className="text-[11px] font-semibold text-foreground">Organization</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Display name for your workspace. Shown in the header and invites.
          </p>
        </div>
      </div>
      <div className="px-3.5 py-3 space-y-3">
        <div>
          <label htmlFor="org-name" className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Organization name
          </label>
          <input
            id="org-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            maxLength={120}
            className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            placeholder="My Organization"
          />
        </div>
        {errorMessage && (
          <p className="text-xs text-destructive" role="alert">
            {errorMessage}
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          {status === "success" && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <Check className="h-3.5 w-3.5" aria-hidden />
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || status === "saving"}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            {status === "saving" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
