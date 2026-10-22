import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
      <p className="mt-2 text-muted-foreground text-center max-w-sm">
        The page you’re looking for doesn’t exist or the URL may be wrong.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Home
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
