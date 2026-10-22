import Link from "next/link";
import {
  ShieldCheck,
  Users,
  Bell,
  FileText,
  ArrowRight,
  Eye,
  LayoutList,
  Network,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

function LogoIcon({ className }: { className?: string }) {
  return (
    <span
      className={`bg-primary flex items-center justify-center shrink-0 text-white [--logo-glow:rgba(255,255,255,0.35)] ${className ?? ""}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="square"
        strokeLinejoin="miter"
        className="w-full h-full drop-shadow-[0_0_5px_var(--logo-glow)]"
      >
        <path d="M7 4v16 M7 4h11 M7 12h9 M7 20h11" />
      </svg>
    </span>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 font-sans antialiased selection:bg-primary selection:text-white scroll-smooth">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-[#09090B]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
            aria-label="Convixa home"
          >
            <LogoIcon className="w-5 h-5" />
            <span className="font-semibold tracking-tighter text-lg text-zinc-900 dark:text-white">CONVIXA</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-[11px] font-medium tracking-widest text-zinc-500 dark:text-zinc-400 uppercase">
            <a href="#why" className="hover:text-primary transition-colors">
              Why Convixa
            </a>
            <a href="#features" className="hover:text-primary transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-primary transition-colors">
              How It Works
            </a>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-xs font-semibold px-4 py-2 hover:text-primary transition-colors"
            >
              LOGIN
            </Link>
            <Link
              href="/register"
              className="bg-primary hover:bg-orange-600 text-white px-4 py-2 text-xs font-semibold tracking-tight transition-all rounded-sm"
            >
              GET STARTED
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative pt-24 pb-12 md:pt-32 md:pb-16 overflow-hidden grid-bg border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 rounded-sm text-[9px] font-mono tracking-widest text-zinc-500 dark:text-zinc-400 uppercase mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden />
            Multisig Visibility Platform
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-semibold tracking-tight mb-6 leading-[1.1] text-zinc-900 dark:text-white">
            One dashboard for every{" "}
            <span className="text-primary">Safe wallet</span>{" "}
            your team manages
          </h1>
          <p className="text-base md:text-lg text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto mb-10 leading-relaxed">
            Add your Safe addresses across Ethereum, Base, Arbitrum, and more. See
            signers, thresholds, pending transactions, and balances in one place.
            Read-only — Convixa never touches your keys.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-primary text-white font-semibold text-xs tracking-widest hover:bg-orange-600 transition-all rounded-sm"
            >
              GET STARTED
            </Link>
          </div>
        </div>

        {/* Dashboard preview */}
        <div className="max-w-5xl mx-auto px-6">
          <div className="relative border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 overflow-hidden shadow-2xl glow-effect rounded-sm">
            <div className="h-8 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-4 gap-1.5 bg-zinc-50 dark:bg-zinc-900/50">
              <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-800" aria-hidden />
              <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-800" aria-hidden />
              <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-800" aria-hidden />
            </div>
            <div className="aspect-[21/9] flex items-center justify-center bg-zinc-50 dark:bg-black/20">
              <div className="w-full h-full flex items-center justify-center p-8">
                <div className="w-full max-w-2xl border border-dashed border-zinc-300 dark:border-zinc-800 p-8 text-center rounded-sm">
                  <span className="text-[9px] font-mono tracking-[0.4em] text-zinc-400 dark:text-zinc-600 uppercase">
                    Dashboard Preview — Safes · Signers · Pending TXs · Alerts
                  </span>
                  <div className="mt-4 flex justify-center gap-3">
                    <div className="w-24 h-12 bg-zinc-200 dark:bg-zinc-900/80 border border-zinc-300 dark:border-zinc-800 rounded-sm flex items-center justify-center">
                      <span className="text-[8px] font-mono text-zinc-400">Treasury</span>
                    </div>
                    <div className="w-24 h-12 bg-zinc-200 dark:bg-zinc-900/80 border border-zinc-300 dark:border-zinc-800 rounded-sm flex items-center justify-center">
                      <span className="text-[8px] font-mono text-zinc-400">Marketing</span>
                    </div>
                    <div className="w-24 h-12 bg-zinc-200 dark:bg-zinc-900/80 border border-zinc-300 dark:border-zinc-800 rounded-sm flex items-center justify-center">
                      <span className="text-[8px] font-mono text-zinc-400">Operations</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Why Convixa — the problem */}
      <section id="why" className="py-20 bg-white dark:bg-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-[10px] font-mono tracking-widest text-primary uppercase mb-3">
              The Problem
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight mb-6 text-zinc-900 dark:text-white">
              Managing multisig wallets across teams and chains is chaos
            </h2>
            <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
              If your organization runs more than a handful of Safe wallets, you know the pain.
            </p>
            <ul className="text-left max-w-md mx-auto space-y-2 mb-8">
              <li className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-400">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-600 shrink-0" aria-hidden />
                Signing requests get buried in DMs
              </li>
              <li className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-400">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-600 shrink-0" aria-hidden />
                You lose track of who needs to sign what
              </li>
              <li className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-400">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-600 shrink-0" aria-hidden />
                Audit requests send you scrambling through block explorers and spreadsheets
              </li>
            </ul>
            <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed mb-12">
              Convixa gives ops and treasury teams a{" "}
              <strong className="text-zinc-900 dark:text-white">single source of truth</strong>{" "}
              for every Safe, every chain, every pending action — without touching your signing keys.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
            <div className="text-center p-6">
              <div className="flex justify-center mb-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-sm bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <Network className="h-5 w-5 text-primary" />
                </span>
              </div>
              <h4 className="font-semibold mb-2 text-sm text-zinc-900 dark:text-white">Scattered Across Chains</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Safes on Ethereum, Base, Arbitrum, Polygon — no single place to see them all.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="flex justify-center mb-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-sm bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <Users className="h-5 w-5 text-primary" />
                </span>
              </div>
              <h4 className="font-semibold mb-2 text-sm text-zinc-900 dark:text-white">Unclear Signing Status</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Who needs to sign? Which transactions are stuck? Teams waste hours coordinating.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="flex justify-center mb-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-sm bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <FileText className="h-5 w-5 text-primary" />
                </span>
              </div>
              <h4 className="font-semibold mb-2 text-sm text-zinc-900 dark:text-white">Audit Headaches</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Pulling transaction histories and signer lists for compliance means digging through explorers manually.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="py-16 bg-zinc-50 dark:bg-[#09090B] border-y border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-8">
            <div className="max-w-2xl">
              <p className="text-[10px] font-mono tracking-widest text-primary uppercase mb-3">Features</p>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight text-zinc-900 dark:text-white">
                Everything you need to track and monitor your multisigs
              </h2>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-sm text-sm leading-relaxed">
              A read-only ops layer for teams running dozens of Safes — organize by department, monitor pending activity, and stay audit-ready.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-t border-l border-zinc-200 dark:border-zinc-800">
            {/* Card 1 */}
            <div className="p-8 border-r border-b border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-900/30 transition-colors">
              <span className="flex h-10 w-10 items-center justify-center text-primary mb-6" aria-hidden>
                <LayoutList className="h-6 w-6" />
              </span>
              <h4 className="font-semibold mb-3 tracking-tight text-sm uppercase text-zinc-900 dark:text-white">
                Unified Inventory
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Register every Safe by network, team, and purpose. Search, filter, and see thresholds, signers, and pending counts in one place.
              </p>
            </div>
            {/* Card 2 */}
            <div className="p-8 border-r border-b border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-900/30 transition-colors">
              <span className="flex h-10 w-10 items-center justify-center text-primary mb-6" aria-hidden>
                <Eye className="h-6 w-6" />
              </span>
              <h4 className="font-semibold mb-3 tracking-tight text-sm uppercase text-zinc-900 dark:text-white">
                Signer Visibility
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                See exactly who can sign on each Safe, what the threshold is, and which transactions are awaiting signatures — across every chain.
              </p>
            </div>
            {/* Card 3 */}
            <div className="p-8 border-r border-b border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-900/30 transition-colors">
              <span className="flex h-10 w-10 items-center justify-center text-primary mb-6" aria-hidden>
                <Bell className="h-6 w-6" />
              </span>
              <h4 className="font-semibold mb-3 tracking-tight text-sm uppercase text-zinc-900 dark:text-white">
                Alerts &amp; Monitoring
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Email and Slack notifications when pending queues grow, transactions stall, or multisig configurations change — know before it becomes a problem.
              </p>
            </div>
            {/* Card 4 */}
            <div className="p-8 border-r border-b border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-900/30 transition-colors">
              <span className="flex h-10 w-10 items-center justify-center text-primary mb-6" aria-hidden>
                <FileText className="h-6 w-6" />
              </span>
              <h4 className="font-semibold mb-3 tracking-tight text-sm uppercase text-zinc-900 dark:text-white">
                Audit &amp; Export
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Download CSV exports of your full inventory and audit logs. Track who added or changed Safes, when, and why — ready for compliance and reporting.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 bg-white dark:bg-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[10px] font-mono tracking-widest text-primary uppercase mb-3">How It Works</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              Set up in minutes, stay in control
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="relative text-center p-8">
              <div className="flex justify-center mb-6">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white text-lg font-bold shadow-lg">
                  1
                </span>
              </div>
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-tight text-zinc-900 dark:text-white">
                Add Your Safes
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Paste your Safe addresses, choose the network, assign a team, and add optional notes. Convixa fetches the latest data from the Safe API.
              </p>
            </div>
            <div className="relative text-center p-8">
              <div className="flex justify-center mb-6">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white text-lg font-bold shadow-lg">
                  2
                </span>
              </div>
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-tight text-zinc-900 dark:text-white">
                Organize &amp; Monitor
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Group Safes by team — Finance, Ops, Marketing. See thresholds, signers, pending transactions, and balances from a single dashboard.
              </p>
            </div>
            <div className="relative text-center p-8">
              <div className="flex justify-center mb-6">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white text-lg font-bold shadow-lg">
                  3
                </span>
              </div>
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-tight text-zinc-900 dark:text-white">
                Get Alerts &amp; Export
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Receive email and Slack alerts when queues grow or configs change. Export inventory and audit logs anytime for compliance.
              </p>
            </div>
          </div>
          <div className="mt-12 text-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-white font-semibold text-xs tracking-widest hover:bg-orange-600 transition-all rounded-sm"
            >
              GET STARTED
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* Security callout */}
      <section className="py-16 bg-zinc-50 dark:bg-[#09090B] border-y border-zinc-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="flex justify-center mb-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-sm bg-primary/10 border border-primary/20">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4 text-zinc-900 dark:text-white">
            Read-only. No custody. No signing keys.
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
            Convixa connects to the Safe Transaction Service API to read your multisig data. It never holds private keys, never signs transactions, and never moves funds. Your security model stays exactly as it is — we just make it visible.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white dark:bg-black relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20" aria-hidden />
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6 text-zinc-900 dark:text-white">
            Stop tracking multisigs in spreadsheets
          </h2>
          <p className="text-base text-zinc-500 dark:text-zinc-400 mb-10 leading-relaxed">
            Get a single source of truth for every Safe wallet across your organization. Self-hosted and open source — deploy in minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-primary text-white font-semibold text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-orange-600 transition-all rounded-sm"
            >
              GET STARTED
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
            <a
              href="https://github.com"
              className="w-full sm:w-auto px-8 py-3.5 bg-transparent border border-zinc-300 dark:border-zinc-800 text-xs font-semibold tracking-widest hover:border-primary transition-all uppercase rounded-sm text-zinc-900 dark:text-zinc-200"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-black border-t border-zinc-100 dark:border-zinc-900 pt-16 pb-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-16">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <LogoIcon className="w-4 h-4" />
                <span className="font-semibold tracking-tighter text-sm text-zinc-900 dark:text-white">CONVIXA</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed pr-4">
                Multisig inventory and monitoring for teams that run on Safe. Read-only, no custody, always audit-ready.
              </p>
            </div>
            <div>
              <h5 className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase mb-5">Product</h5>
              <ul className="space-y-2.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <li><Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link></li>
                <li><Link href="/dashboard/alerts" className="hover:text-primary transition-colors">Alerts</Link></li>
                <li><Link href="/docs" className="hover:text-primary transition-colors">API Access</Link></li>
                <li><Link href="/docs" className="hover:text-primary transition-colors">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase mb-5">Company</h5>
              <ul className="space-y-2.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <li><Link href="/about" className="hover:text-primary transition-colors">About</Link></li>
                <li><Link href="/careers" className="hover:text-primary transition-colors">Careers</Link></li>
                <li><Link href="/docs#legal" className="hover:text-primary transition-colors">Legal</Link></li>
                <li><Link href="/docs#security" className="hover:text-primary transition-colors">Security</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase mb-5">Connect</h5>
              <ul className="space-y-2.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <li><Link href="/about" className="hover:text-primary transition-colors">Contact</Link></li>
                <li><Link href="/about" className="hover:text-primary transition-colors">Support</Link></li>
                <li><a href="https://github.com" className="hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">GitHub</a></li>
                <li><Link href="/docs#status" className="hover:text-primary transition-colors">Status</Link></li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-zinc-100 dark:border-zinc-900 gap-4">
            <p className="text-[9px] font-mono text-zinc-400 tracking-widest uppercase">
              &copy; {new Date().getFullYear()} CONVIXA. ALL RIGHTS RESERVED.
            </p>
            <div className="flex gap-8">
              <Link href="/docs#privacy" className="text-[9px] font-mono text-zinc-400 tracking-widest uppercase hover:text-primary transition-colors">
                Privacy
              </Link>
              <Link href="/docs#terms" className="text-[9px] font-mono text-zinc-400 tracking-widest uppercase hover:text-primary transition-colors">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>

      <ThemeToggle />
    </div>
  );
}
