"use client";

import { useState, useEffect } from "react";
import { Shield, Loader2 } from "lucide-react";

interface TwoFactorSectionProps {
  lastSignedIn?: string | null;
}

export function TwoFactorSection({ lastSignedIn }: TwoFactorSectionProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [sendOtpLoading, setSendOtpLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [error, setError] = useState("");
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/user/2fa")
      .then((r) => r.json())
      .then((d) => setEnabled(d.enabled === true))
      .catch(() => setEnabled(false));
  }, []);

  async function handleToggle() {
    if (enabled) {
      setError("Disabling 2FA is not implemented. Contact support if needed.");
      return;
    }
    setError("");
    setSuccess("");
    setShowOtpModal(true);
    setSendOtpLoading(true);
    try {
      const res = await fetch("/api/user/2fa/send-otp", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to send code");
        setShowOtpModal(false);
        return;
      }
      setSuccess("Verification code sent to your email. Enter it below.");
    } catch {
      setError("Something went wrong");
      setShowOtpModal(false);
    } finally {
      setSendOtpLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim()) return;
    setError("");
    setVerifyLoading(true);
    try {
      const res = await fetch("/api/user/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otp.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Invalid code");
        return;
      }
      setEnabled(true);
      setShowOtpModal(false);
      setOtp("");
      setSuccess("2FA is now enabled. You'll need a code from your email when signing in.");
    } catch {
      setError("Something went wrong");
    } finally {
      setVerifyLoading(false);
    }
  }

  const isLoading = enabled === null;

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <Shield className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">Two-factor authentication</h3>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            Require email verification for every login attempt.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!isLoading && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                enabled
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              }`}
              aria-live="polite"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                aria-hidden
              />
              {enabled ? "On" : "Off"}
            </span>
          )}

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={enabled ?? false}
              onChange={handleToggle}
              disabled={sendOtpLoading || isLoading}
              className="sr-only peer"
              aria-label={enabled ? "Disable 2FA" : "Enable 2FA"}
              role="switch"
              aria-checked={enabled ?? false}
            />
            {isLoading ? (
              <div className="w-10 h-5 rounded-full bg-muted animate-pulse" />
            ) : (
              <div className="w-10 h-5 bg-muted peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-background rounded-full peer-checked:bg-primary transition-colors duration-200 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:shadow-sm after:transition-transform after:duration-200 after:ease-out peer-checked:after:translate-x-[20px]" />
            )}
          </label>
        </div>
      </div>

      {/* Last signed in */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground/70 mt-3">
        <span>Last signed in</span>
        <span>{lastSignedIn ?? "—"}</span>
      </div>

      {success && !showOtpModal && (
        <div className="mt-3 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-sm text-foreground">
          {success}
        </div>
      )}
      {error && !showOtpModal && (
        <div className="mt-3 rounded-lg bg-destructive/10 text-sm text-destructive px-3 py-2">
          {error}
        </div>
      )}

      {/* OTP modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="rounded-xl border border-border bg-card shadow-lg w-full max-w-sm p-6">
            <h3 className="font-semibold text-foreground">Enter verification code</h3>
            <p className="text-sm text-muted-foreground mt-1">
              We sent a 6-digit code to your email. Enter it below.
            </p>
            {success && <p className="text-sm text-primary mt-2">{success}</p>}
            <form onSubmit={handleVerifyOtp} className="mt-4 space-y-4">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-center text-lg font-mono tracking-[0.5em] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary min-h-[44px]"
                spellCheck={false}
                aria-label="Verification code"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowOtpModal(false); setOtp(""); setError(""); }}
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyLoading || otp.length !== 6}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 min-h-[44px]"
                >
                  {verifyLoading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden /> : null}
                  {verifyLoading ? "Verifying…" : "Verify"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
