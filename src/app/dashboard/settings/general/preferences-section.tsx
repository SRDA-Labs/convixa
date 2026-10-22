"use client";

import { useState, useCallback } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Check, Loader2, Settings2, DollarSign, CalendarDays, ChevronDown } from "lucide-react";

type Theme = "light" | "dark" | "system";
type Currency = "USD" | "EUR" | "GBP" | "ETH" | "BTC";
type DateFormat = "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";

interface Preferences {
  theme: Theme;
  currency: string;
  dateFormat: string;
  compactMode: boolean;
}

interface PreferencesSectionProps {
  initialPreferences: Preferences;
}

const CURRENCIES: { value: Currency; label: string; symbol: string }[] = [
  { value: "USD", label: "US Dollar", symbol: "$" },
  { value: "EUR", label: "Euro", symbol: "€" },
  { value: "GBP", label: "British Pound", symbol: "£" },
  { value: "ETH", label: "Ethereum", symbol: "Ξ" },
  { value: "BTC", label: "Bitcoin", symbol: "₿" },
];

const DATE_FORMATS: { value: DateFormat; label: string; example: string }[] = [
  { value: "MM/DD/YYYY", label: "US", example: "12/31/2025" },
  { value: "DD/MM/YYYY", label: "EU", example: "31/12/2025" },
  { value: "YYYY-MM-DD", label: "ISO", example: "2025-12-31" },
];

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function optionButtonClasses(isActive: boolean) {
  const base =
    "flex items-center gap-1 px-2 py-1.5 rounded text-[11px] font-medium transition-colors motion-safe:transition-shadow motion-safe:duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:ring-offset-1 focus-visible:ring-offset-card";
  if (isActive) {
    return `${base} border-primary/50 bg-primary/5 text-primary ring-1 ring-primary/20 shadow-sm shadow-primary/5`;
  }
  return `${base} border-border bg-muted/30 text-muted-foreground hover:border-border/80 hover:bg-muted/50 hover:text-foreground active:scale-[0.98]`;
}

function dateBtnClasses(isActive: boolean) {
  const base =
    "flex flex-col items-start gap-0.5 px-2 py-1.5 rounded border text-left transition-colors motion-safe:transition-shadow motion-safe:duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:ring-offset-1 focus-visible:ring-offset-card";
  if (isActive) {
    return `${base} border-primary/50 bg-primary/5 ring-1 ring-primary/20 shadow-sm shadow-primary/5`;
  }
  return `${base} border-border bg-muted/30 hover:border-border/80 hover:bg-muted/50 active:scale-[0.98]`;
}

export function PreferencesSection({ initialPreferences }: PreferencesSectionProps) {
  const { theme: nextTheme, setTheme } = useTheme();
  const [prefs, setPrefs] = useState<Preferences>(initialPreferences);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const savePreferences = useCallback(async (updated: Preferences, key: string) => {
    setSavingKey(key);
    setStatus("saving");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: updated }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Failed to save preferences.");
      }

      setStatus("success");
      setSavingKey(null);
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setSavingKey(null);
    }
  }, []);

  function handleThemeChange(value: Theme) {
    setTheme(value);
    const updated = { ...prefs, theme: value };
    setPrefs(updated);
    savePreferences(updated, "theme");
  }

  function handleCurrencyChange(value: string) {
    const updated = { ...prefs, currency: value };
    setPrefs(updated);
    savePreferences(updated, "currency");
  }

  function handleDateFormatChange(value: string) {
    const updated = { ...prefs, dateFormat: value };
    setPrefs(updated);
    savePreferences(updated, "dateFormat");
  }

  function handleCompactModeChange(checked: boolean) {
    const updated = { ...prefs, compactMode: checked };
    setPrefs(updated);
    savePreferences(updated, "compactMode");
  }

  const statusIndicator =
    status === "saving" ? (
      <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground ml-auto" aria-label="Saving" />
    ) : status === "success" ? (
      <span className="ml-auto text-[10px] text-emerald-500 inline-flex items-center gap-0.5 motion-safe:animate-in motion-safe:fade-in">
        <Check className="h-2.5 w-2.5" />
        Saved
      </span>
    ) : status === "error" ? (
      <span className="ml-auto text-[10px] text-destructive motion-safe:animate-in motion-safe:fade-in">Failed to save</span>
    ) : null;

  return (
    <div className="rounded-md border border-border/60 bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-border/40">
        <div className="flex items-center gap-1">
          <Settings2 className="h-3 w-3 text-muted-foreground" aria-hidden />
          <h3 className="text-[11px] font-semibold text-foreground">Preferences</h3>
          {statusIndicator}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5 ml-4">
          Customize your app appearance, currency, and display density.
        </p>
      </div>

      {/* Theme */}
      <div className="px-3.5 py-2.5 border-b border-border/40">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Theme
        </label>
        <div className="mt-1 grid grid-cols-3 gap-1">
          {THEMES.map(({ value, label, icon: Icon }) => {
            const isActive = (nextTheme as Theme) === value;
            const isSaving = savingKey === "theme" && status === "saving";
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleThemeChange(value)}
                disabled={isSaving}
                className={optionButtonClasses(isActive)}
                aria-pressed={isActive}
              >
                <Icon className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">{label}</span>
                {isActive && isSaving && (
                  <Loader2 className="h-2.5 w-2.5 animate-spin shrink-0 ml-auto" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Currency */}
      <div className="px-3.5 py-2.5 border-b border-border/40">
        <div className="flex items-center gap-1 mb-1">
          <DollarSign className="h-2.5 w-2.5 text-muted-foreground" aria-hidden />
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Default currency
          </label>
        </div>
        <div className="relative">
          <select
            value={prefs.currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="w-full bg-muted/40 border border-border rounded text-[11px] pl-2 pr-7 py-1 focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50 focus:bg-background transition-colors motion-safe:duration-150 appearance-none cursor-pointer"
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.symbol} {c.label} ({c.value})
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none"
            aria-hidden
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Fiat and token values default to this currency where applicable.
        </p>
      </div>

      {/* Date format */}
      <div className="px-3.5 py-2.5 border-b border-border/40">
        <div className="flex items-center gap-1 mb-1">
          <CalendarDays className="h-2.5 w-2.5 text-muted-foreground" aria-hidden />
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Date format
          </label>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {DATE_FORMATS.map(({ value, label, example }) => {
            const isActive = prefs.dateFormat === value;
            const isSaving = savingKey === "dateFormat" && status === "saving";
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleDateFormatChange(value)}
                disabled={isSaving}
                className={dateBtnClasses(isActive)}
                aria-pressed={isActive}
              >
                <span className="text-[10px] font-semibold text-foreground">{label}</span>
                <span className="text-[10px] text-muted-foreground">{example}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Compact mode */}
      <div className="px-3.5 py-2.5">
        <div className="flex items-start gap-2">
          <div className="flex h-3.5 items-center">
            <input
              id="compact-mode"
              type="checkbox"
              checked={prefs.compactMode}
              onChange={(e) => handleCompactModeChange(e.target.checked)}
              className="h-3 w-3 rounded border-border text-primary cursor-pointer transition-colors motion-safe:duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:ring-offset-1 focus-visible:ring-offset-card"
            />
          </div>
          <div className="min-w-0 flex-1">
            <label
              htmlFor="compact-mode"
              className="text-[11px] font-medium text-foreground cursor-pointer select-none"
            >
              Compact mode
            </label>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Reduce padding and row heights in tables and cards for a denser layout.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
