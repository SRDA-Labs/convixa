"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Shield, GitBranch, Lock } from "lucide-react";

function passwordStrengthLevel(password: string): number {
  if (!password.length) return 0;
  if (password.length < 4) return 1;
  if (password.length < 7) return 2;
  if (password.length < 10) return 3;
  return 4;
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strengthLevel = useMemo(() => passwordStrengthLevel(password), [password]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Sign-up failed. Try again.");
        return;
      }
      const signInRes = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (signInRes?.error) {
        setError("Account created but sign-in failed. Please sign in on the login page.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-black text-zinc-100 antialiased">
      {/* Header */}
      <header className="w-full px-6 lg:px-10 py-5 flex items-center justify-between border-b border-zinc-900 bg-black sticky top-0 z-50">
        <Link
          href="/"
          className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded"
          aria-label="Convixa home"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <Shield className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-sm font-extrabold tracking-[0.3em] uppercase text-white">Convixa</span>
        </Link>
        <nav className="hidden md:flex items-center gap-10" aria-label="Main">
          <Link href="#infrastructure" className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 hover:text-white transition-colors">
            Infrastructure
          </Link>
          <Link href="#governance" className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 hover:text-white transition-colors">
            Governance
          </Link>
          <Link href="#security" className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 hover:text-white transition-colors">
            Security
          </Link>
        </nav>
        <div className="flex items-center gap-6">
          <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest text-zinc-700">Access Portal</span>
          <Link
            href="/login"
            className="px-5 py-2 text-[10px] font-bold uppercase tracking-[0.15em] border border-zinc-800 hover:bg-zinc-900 rounded-sm transition-all text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Sign In
          </Link>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-6 lg:p-12 bg-black">
        <div className="max-w-[1100px] w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left: Copy + features */}
          <div className="hidden lg:flex flex-col gap-12 lg:col-span-6">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 px-0 py-1">
                <span className="h-px w-10 bg-zinc-800" aria-hidden />
                <span className="text-[10px] font-bold text-zinc-500 tracking-[0.25em] uppercase">Treasury Orchestration</span>
              </div>
              <h2 className="text-4xl font-semibold leading-[1.15] tracking-tight text-white">
                High-density management and execution for{" "}
                <span className="text-zinc-500 font-light">institutional treasuries.</span>
              </h2>
              <p className="text-sm text-zinc-500 max-w-sm leading-relaxed">
                A unified orchestration layer for complex digital asset operations. Secure, non-custodial, and engineered for high-frequency professional workflows.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-10">
              <div className="flex gap-5 items-start">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden>
                  <GitBranch className="h-5 w-5" />
                </span>
                <div>
                  <h4 className="font-bold text-[10px] uppercase tracking-[0.15em] text-zinc-200">On-Chain Execution</h4>
                  <p className="text-[11px] leading-relaxed text-zinc-500 mt-1.5 font-medium">
                    Streamlined transaction lifecycle management across multiple networks.
                  </p>
                </div>
              </div>
              <div className="flex gap-5 items-start">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden>
                  <Shield className="h-5 w-5" />
                </span>
                <div>
                  <h4 className="font-bold text-[10px] uppercase tracking-[0.15em] text-zinc-200">Enterprise Auditability</h4>
                  <p className="text-[11px] leading-relaxed text-zinc-500 mt-1.5 font-medium">
                    Full transparency and historical logs for every organizational move.
                  </p>
                </div>
              </div>
            </div>
            <div className="pt-8 border-t border-zinc-900 flex items-center gap-6">
              <div className="flex -space-x-2" aria-hidden>
                <span className="size-6 rounded-full border border-black bg-zinc-800 grayscale opacity-60" />
                <span className="size-6 rounded-full border border-black bg-zinc-800 grayscale opacity-60" />
                <span className="size-6 rounded-full border border-black bg-zinc-800 grayscale opacity-60" />
              </div>
              <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-[0.2em]">Institutional Standard</p>
            </div>
          </div>

          {/* Right: Form card */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-[440px] bg-zinc-900 border border-zinc-800 p-10 rounded-sm shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
              <div className="mb-10">
                <h3 className="text-xl font-semibold text-white mb-2 tracking-tight">Create your account</h3>
                <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-bold">Self-hosted · Open source</p>
              </div>
              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                className="w-full bg-black border border-zinc-800 rounded-sm px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-900 transition-all flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                aria-label="Sign up with Google"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign up with Google
              </button>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-zinc-800" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-[0.15em]">
                  <span className="bg-zinc-900 px-2 text-zinc-600">or</span>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500 mb-1.5 block">
                    Institutional Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="admin@firm.com"
                    autoComplete="email"
                    className="w-full bg-black border border-zinc-800 rounded-sm px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-700 focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500 mb-1.5 block">
                    Security Credentials
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Minimum 12 characters"
                    autoComplete="new-password"
                    className="w-full bg-black border border-zinc-800 rounded-sm px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-700 focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                  />
                  <div className="flex gap-1 pt-2 items-center">
                    {[1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className={`h-0.5 flex-1 rounded-sm ${i <= strengthLevel ? "bg-zinc-600" : "bg-zinc-950"}`}
                        aria-hidden
                      />
                    ))}
                    <span className="text-[8px] font-bold text-zinc-700 ml-2 uppercase tracking-tight">
                      Level {strengthLevel === 0 ? 1 : strengthLevel}
                    </span>
                  </div>
                </div>
                {error && (
                  <p className="text-sm text-red-400 font-medium" role="alert">
                    {error}
                  </p>
                )}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary/90 text-zinc-950 font-bold py-3.5 rounded-sm transition-all flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.18em] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                  >
                    {loading ? "Creating account…" : "Create account"}
                  </button>
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Lock className="h-3.5 w-3.5 text-zinc-700 shrink-0" aria-hidden />
                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-700">
                      Non-Custodial Setup • No Card Required
                    </p>
                  </div>
                </div>
              </form>
              <div className="mt-10 pt-6 border-t border-zinc-800/50">
                <p className="text-center text-[9px] text-zinc-600 leading-relaxed uppercase tracking-[0.12em]">
                  By enrolling, you acknowledge our{" "}
                  <Link href="/docs#terms" className="text-zinc-500 hover:text-primary transition-colors underline decoration-zinc-800 underline-offset-2">
                    Service Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="/docs#privacy" className="text-zinc-500 hover:text-primary transition-colors underline decoration-zinc-800 underline-offset-2">
                    Privacy Protocol
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 px-6 lg:px-10 border-t border-zinc-900 bg-black flex flex-col md:flex-row justify-between items-center gap-6 text-[9px] font-bold text-zinc-700 tracking-[0.2em] uppercase">
        <div>© {new Date().getFullYear()} Convixa · SRDA Labs</div>
        <div className="flex gap-10 items-center">
          <Link href="/docs#status" className="hover:text-zinc-400 transition-colors">
            Network Status
          </Link>
          <Link href="/docs#compliance" className="hover:text-zinc-400 transition-colors">
            Compliance
          </Link>
          <Link href="/docs#legal" className="hover:text-zinc-400 transition-colors">
            Legal
          </Link>
          <div className="flex items-center gap-2 pl-6 border-l border-zinc-900">
            <span className="size-1.5 bg-green-600 rounded-full" aria-hidden />
            <span className="text-zinc-700">Operational</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
