import Link from "next/link";

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="font-bold text-xl tracking-tight text-foreground text-pretty focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 rounded">
            Convixa
          </Link>
          <Link href="/login" className="text-sm font-medium text-primary hover:text-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 rounded min-h-[44px] inline-flex items-center">
            Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16 min-w-0">
        <h1 className="text-3xl font-bold text-foreground text-pretty">Careers</h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          We’re building tools for teams that manage multisigs at scale. If you’re interested in joining us, get in touch.
        </p>
        <Link href="/" className="mt-8 inline-flex items-center min-h-[44px] text-sm font-medium text-primary hover:text-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 rounded">
          ← Back to home
        </Link>
      </main>
    </div>
  );
}
