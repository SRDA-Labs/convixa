"use client";

import { useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { Camera, Loader2, Check, Wallet, History } from "lucide-react";
import { ConnectWalletSection } from "../profile/connect-wallet-section";
import { ActivityFeed } from "./activity-feed";

const TIMEZONES = Intl.supportedValuesOf("timeZone");

interface UnifiedProfileFormProps {
  initialName: string | null;
  email: string | null;
  initialTimezone: string;
  initialImage: string | null;
  linkedWalletAddress: string | null;
}

export function UnifiedProfileForm({
  initialName,
  email,
  initialTimezone,
  initialImage,
  linkedWalletAddress,
}: UnifiedProfileFormProps) {
  const { update } = useSession();
  const [name, setName] = useState(initialName ?? "");
  const [imageUrl, setImageUrl] = useState(initialImage ?? "");
  const [imagePreview, setImagePreview] = useState(initialImage ?? "");
  const [timezone, setTimezone] = useState(initialTimezone);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [showImageInput, setShowImageInput] = useState(false);

  const isDirty =
    name.trim() !== (initialName ?? "") ||
    imageUrl.trim() !== (initialImage ?? "") ||
    timezone !== initialTimezone;

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
      const body: Record<string, unknown> = { name: trimmed, timezone };
      if (imageUrl.trim()) {
        body.image = imageUrl.trim();
      } else if (initialImage && !imageUrl.trim()) {
        body.image = null;
      }

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Failed to save.");
      }

      const json = (await res.json()) as {
        name: string | null;
        image: string | null;
        timezone: string | null;
      };

      await update({ name: json.name });
      setName(json.name ?? trimmed);
      setImageUrl(json.image ?? "");
      setImagePreview(json.image ?? "");
      setTimezone(json.timezone ?? timezone);
      setShowImageInput(false);
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save.");
      setStatus("error");
    }
  }

  function handleCancel() {
    setName(initialName ?? "");
    setImageUrl(initialImage ?? "");
    setImagePreview(initialImage ?? "");
    setTimezone(initialTimezone);
    setShowImageInput(false);
    setStatus("idle");
    setErrorMessage("");
  }

  return (
    <div className="rounded-md border border-border/60 bg-card overflow-hidden shadow-sm">
      {/* ---- Identity header ---- */}
      <div className="px-3.5 py-2.5 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          {/* Avatar */}
          <div className="relative group shrink-0">
            {imagePreview ? (
              <img
                src={imagePreview}
                alt=""
                className="h-9 w-9 rounded-full object-cover ring-1 ring-border"
                onError={() => setImagePreview("")}
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-border flex items-center justify-center" />
            )}
            <button
              type="button"
              onClick={() => setShowImageInput(!showImageInput)}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Change avatar"
            >
              <Camera className="h-3 w-3 text-white" />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-foreground">Avatar</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {imagePreview
                ? "Hover the avatar to change its URL."
                : "Add a profile photo via URL."}
            </p>
          </div>
        </div>

        {showImageInput && (
          <div className="mt-1.5 ml-[44px]">
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="w-full bg-muted/40 border border-border rounded text-[11px] px-2 py-1 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50 focus:bg-background transition-all"
            />
          </div>
        )}
      </div>

      {/* ---- Editable fields ---- */}
      <div className="px-3.5 py-2.5 border-b border-border/40 space-y-2.5">
        {/* Display Name */}
        <div className="space-y-0.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Display Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (status !== "idle") setStatus("idle");
            }}
            placeholder="Your name"
            className="w-full bg-muted/40 border border-border rounded text-[11px] px-2 py-1 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50 focus:bg-background transition-all"
          />
        </div>

        {/* Email (read-only) */}
        <div className="space-y-0.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Email Address
          </label>
          <div className="flex items-center gap-1.5 w-full bg-muted/40 border border-border rounded px-2 py-1">
            <span className="flex-1 text-[11px] text-muted-foreground truncate">
              {email ?? "—"}
            </span>
            <Check
              className="h-3 w-3 text-emerald-500 shrink-0"
              aria-hidden
            />
          </div>
        </div>

        {/* Timezone */}
        <div className="space-y-0.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => {
              setTimezone(e.target.value);
              if (status !== "idle") setStatus("idle");
            }}
            className="w-full bg-muted/40 border border-border rounded text-[11px] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50 focus:bg-background transition-all appearance-none"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Timestamps across the app will be shown in your local time.
          </p>
        </div>
      </div>

      {/* ---- Linked wallet ---- */}
      <div className="px-3.5 py-2.5 border-b border-border/40">
        <div className="flex items-center gap-1 mb-1.5">
          <Wallet className="h-2.5 w-2.5 text-muted-foreground" aria-hidden />
          <h3 className="text-[11px] font-semibold text-foreground">Linked wallet</h3>
        </div>
        <ConnectWalletSection
          linkedWalletAddress={linkedWalletAddress}
          hideHeading
        />
      </div>

      {/* ---- Recent activity ---- */}
      <div className="px-3.5 py-2.5 border-b border-border/40">
        <div className="flex items-center gap-1 mb-1.5">
          <History className="h-2.5 w-2.5 text-muted-foreground" aria-hidden />
          <h3 className="text-[11px] font-semibold text-foreground">Recent activity</h3>
        </div>
        <ActivityFeed compact />
      </div>

      {/* ---- Save bar ---- */}
      {(isDirty || status === "error") && (
        <div className="flex items-center justify-end gap-2 px-3.5 py-1.5 bg-muted/20">
          {status === "success" && (
            <span className="text-[10px] text-emerald-500 mr-auto">Saved successfully.</span>
          )}
          {status === "error" && (
            <span className="text-[10px] text-destructive mr-auto">{errorMessage}</span>
          )}
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={status === "saving" || !isDirty}
            className="px-3 py-1 bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] font-semibold rounded transition-all shadow-sm shadow-primary/10 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            {status === "saving" && (
              <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden />
            )}
            {status === "saving" ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
