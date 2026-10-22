"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

interface ProfileDetailsFormProps {
  initialName: string | null;
  email: string | null;
}

export function ProfileDetailsForm({ initialName, email }: ProfileDetailsFormProps) {
  const { update } = useSession();
  const [name, setName] = useState(initialName ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessage("Name cannot be empty.");
      setStatus("error");
      return;
    }

    setStatus("saving");
    setErrorMessage("");

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Failed to save.");
      }

      const json = await res.json() as { name: string | null };
      // Refresh the NextAuth session so the displayed name updates in-place.
      await update({ name: json.name });
      setName(json.name ?? trimmed);
      setStatus("success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save.");
      setStatus("error");
    }
  }

  function handleCancel() {
    setName(initialName ?? "");
    setStatus("idle");
    setErrorMessage("");
  }

  return (
    <>
      <div className="grid gap-5">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (status !== "idle") setStatus("idle");
            }}
            placeholder="John Doe"
            className="w-full bg-muted/40 border border-border rounded-lg text-sm px-3 py-2 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-background transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Email Address
          </label>
          <div className="flex items-center gap-3 w-full bg-muted/40 border border-border rounded-lg px-3 py-2">
            <input
              type="email"
              readOnly
              value={email ?? ""}
              className="flex-1 bg-transparent border-none p-0 text-sm text-muted-foreground focus:ring-0 focus:outline-none min-w-0"
              aria-readonly
            />
            <span className="text-emerald-500 shrink-0" aria-hidden>
              <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </span>
          </div>
        </div>
      </div>

      <div className="pt-4 flex items-center justify-end border-t border-border/60 mt-5">
        <div className="flex items-center gap-4">
          {status === "success" && (
            <span className="text-xs text-emerald-500">Saved successfully.</span>
          )}
          {status === "error" && (
            <span className="text-xs text-destructive">{errorMessage}</span>
          )}
          <button
            type="button"
            onClick={handleCancel}
            className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={status === "saving"}
            className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-md transition-all shadow-sm shadow-primary/10 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === "saving" ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </>
  );
}
