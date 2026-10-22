"use client";

import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "OAuthAccountNotLinked") setError("This email is already used with another sign-in method. Sign in with email and password instead.");
    else if (err) setError("Sign-in with Google was cancelled or failed. Try again.");
  }, [searchParams]);
  const { openConnectModal } = useConnectModal();
  const { isConnected } = useAccount();

  function handleConnectWallet() {
    if (isConnected) {
      router.push("/wallet");
      return;
    }
    openConnectModal?.();
  }

  async function handleSubmitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/check-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setError("Invalid email or password");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      if (data.requireOtp) {
        setStep("otp");
        setError("");
        return;
      }
      const signInRes = await signIn("credentials", { email, password, redirect: false });
      if (signInRes?.error) {
        setError("Invalid email or password");
        return;
      }
      finishSignIn();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/verify-login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, otp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Invalid or expired code");
        return;
      }
      const signInRes = await signIn("credentials", {
        loginToken: data.loginToken,
        redirect: false,
      });
      if (signInRes?.error) {
        setError("Sign-in failed. Try again.");
        return;
      }
      finishSignIn();
    } catch {
      setError("Something went wrong");
    } finally {
      setOtpLoading(false);
    }
  }

  function finishSignIn() {
    router.push(callbackUrl || "/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md rounded-xl border border-border bg-card card-glow p-8 shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Sign in</h1>
          <p className="text-muted-foreground text-sm mt-1">Multisig Inventory</p>
        </div>
        {isConnected && (
          <div className="mb-6 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Wallet connected.{" "}
            <Link href="/wallet" className="font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 rounded">
              Go to wallet view
            </Link>
            {" "}or sign in with email below to access your organization dashboard.
          </div>
        )}
        {step === "credentials" ? (
        <>
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl })}
          className="w-full rounded-lg border border-border bg-muted/30 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 min-h-[44px]"
          aria-label="Sign in with Google"
        >
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </button>
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>
        <form onSubmit={handleSubmitCredentials} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-input bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-colors min-h-[44px]"
              placeholder="you@example.com"
              autoComplete="email"
              name="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-input bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-colors min-h-[44px]"
              autoComplete="current-password"
              name="password"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 min-h-[44px] btn-primary-glow"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 rounded">
              Create account
            </Link>
          </p>
        </form>
        </>
      ) : (
        <form onSubmit={handleSubmitOtp} className="space-y-5">
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to <strong className="text-foreground">{email}</strong>. Enter it below.
          </p>
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-foreground mb-2">
              Verification code
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full rounded-lg border border-input bg-secondary/50 px-4 py-2.5 text-center text-lg font-mono tracking-[0.4em] text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-colors min-h-[44px]"
              spellCheck={false}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setStep("credentials"); setOtp(""); setError(""); }}
              className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 min-h-[44px]"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={otpLoading || otp.length !== 6}
              className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 min-h-[44px] btn-primary-glow"
            >
              {otpLoading ? "Verifying…" : "Verify and sign in"}
            </button>
          </div>
        </form>
      )}

      {step === "credentials" && (
          <>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleConnectWallet}
            className="w-full rounded-lg border border-border bg-muted/30 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 min-h-[44px]"
            aria-label="Connect your wallet"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
            </svg>
            Connect your wallet
          </button>
          <p className="text-xs text-center text-muted-foreground">
            Privacy-first: view your multisigs without an account
          </p>
        </>
      )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
