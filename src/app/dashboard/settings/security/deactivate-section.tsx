"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react";

export function DeactivateSection() {
  // Step: "blurred" | "warning" | "revealed" | "sending_otp" | "otp_sent" | "verifying" | "deactivated"
  const [step, setStep] = useState<"blurred" | "warning" | "revealed" | "sending_otp" | "otp_sent" | "verifying" | "deactivated">("blurred");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSendOtp() {
    setError("");
    setSuccess("");
    setStep("sending_otp");
    try {
      const res = await fetch("/api/user/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_otp" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to send verification code");
        setStep("revealed");
        return;
      }
      setSuccess("A verification code has been sent to your email. Enter it below to confirm deactivation.");
      setStep("otp_sent");
    } catch {
      setError("Something went wrong. Please try again.");
      setStep("revealed");
    }
  }

  async function handleConfirmDeactivate(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim()) return;
    setError("");
    setStep("verifying");
    try {
      const res = await fetch("/api/user/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", otp: otp.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Verification failed");
        setStep("otp_sent");
        return;
      }
      setStep("deactivated");
    } catch {
      setError("Something went wrong. Please try again.");
      setStep("otp_sent");
    }
  }

  return (
    <>
      {/* Deactivation section with extra spacing */}
      <div className="px-6 py-6 bg-destructive/[0.02] relative min-h-[190px]">
        {/* Blur overlay */}
        {step === "blurred" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center backdrop-blur-md bg-background/40 rounded-b-xl">
            <div className="flex flex-col items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-muted-foreground/60" aria-hidden />
              <p className="text-sm font-medium text-muted-foreground">Sensitive Area</p>
              <p className="text-xs text-muted-foreground/60 text-center max-w-xs">
                This section contains account deactivation controls.
              </p>
              <button
                type="button"
                onClick={() => setStep("warning")}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 min-h-[44px]"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden />
                View sensitive area
              </button>
            </div>
          </div>
        )}

        {/* Actual content (blurred underneath when step is "blurred") */}
        <div className={step === "blurred" ? "select-none pointer-events-none" : ""}>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-destructive">
                Deactivate account
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Permanently deactivate your account. All data, memberships, and
                access will be irreversibly removed.
              </p>
            </div>

            {/* Re-blur button when revealed */}
            {step !== "blurred" && step !== "deactivated" && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setStep("blurred");
                    setOtp("");
                    setError("");
                    setSuccess("");
                  }}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 min-h-[36px]"
                  title="Hide sensitive area"
                >
                  <EyeOff className="h-3.5 w-3.5" aria-hidden />
                  Hide
                </button>

                {step === "revealed" && (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="shrink-0 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/30 min-h-[36px]"
                  >
                    Deactivate
                  </button>
                )}

                {step === "sending_otp" && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    Sending code…
                  </span>
                )}
              </div>
            )}
          </div>

          {/* OTP verification area */}
          {(step === "otp_sent" || step === "verifying") && (
            <form onSubmit={handleConfirmDeactivate} className="mt-5 space-y-4">
              {success && (
                <div className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-2.5 text-xs text-foreground">
                  {success}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="deactivate-otp" className="text-xs font-medium text-foreground">
                  Verification code
                </label>
                <input
                  id="deactivate-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full max-w-[200px] rounded-lg border border-border bg-background px-4 py-2.5 text-center text-lg font-mono tracking-[0.5em] focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/30 focus-visible:border-destructive/50 min-h-[44px]"
                  spellCheck={false}
                  aria-label="Verification code for account deactivation"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 text-xs text-destructive px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={step === "verifying" || otp.length !== 6}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-5 py-2.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/30 focus-visible:ring-offset-2 min-h-[44px] transition-colors"
              >
                {step === "verifying" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                    Verifying…
                  </>
                ) : (
                  "Confirm deactivation"
                )}
              </button>
            </form>
          )}

          {/* Deactivated state */}
          {step === "deactivated" && (
            <div className="mt-5 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
              <p className="text-sm font-medium text-destructive">
                Your account has been deactivated.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                You will be redirected shortly. If nothing happens,{" "}
                <Link href="/api/auth/signout" className="underline hover:text-foreground">
                  click here to sign out
                </Link>
                .
              </p>
            </div>
          )}

          {/* Error at revealed step */}
          {step === "revealed" && error && (
            <div className="mt-4 rounded-lg bg-destructive/10 text-xs text-destructive px-3 py-2">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Warning modal */}
      {step === "warning" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="rounded-xl border border-destructive/20 bg-card shadow-lg w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Critical area</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Please read carefully before proceeding
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                You are about to access account deactivation controls. This is a{" "}
                <strong className="text-foreground">permanent and irreversible</strong> action.
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>All your data will be permanently deleted</li>
                <li>All organization memberships will be removed</li>
                <li>This action <strong className="text-destructive">cannot be undone</strong></li>
              </ul>
              <p className="text-xs">
                Deactivation requires email verification (OTP) — you cannot accidentally
                deactivate your account with a single click.
              </p>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setStep("blurred")}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 min-h-[44px] transition-colors"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={() => setStep("revealed")}
                className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/30 focus-visible:ring-offset-2 min-h-[44px] transition-colors"
              >
                I understand, proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
