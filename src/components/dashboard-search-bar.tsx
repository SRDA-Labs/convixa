"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Shield, Users, UserCog, Bell, ArrowRight, Search } from "lucide-react";

type SearchResults = {
  safes: Array<{ id: string; name: string | null; address: string; network: string; teamId: string; teamName: string }>;
  teams: Array<{ id: string; name: string; slug: string }>;
  members: Array<{ id: string; userId: string; email: string | null; name: string | null }>;
  roles: Array<{ id: string; name: string; slug: string }>;
  alertRules: Array<{ id: string; name: string | null; type: string; safeId: string | null }>;
  nav: Array<{ href: string; label: string }>;
};

const DEBOUNCE_MS = 200;
const MIN_QUERY_LENGTH = 2;
const CLOSE_ANIMATION_MS = 150;

function truncateAddress(addr: string, start = 6, end = 4): string {
  if (addr.length <= start + end) return addr;
  return `${addr.slice(0, start)}…${addr.slice(-end)}`;
}

function ResultsContent({
  loading,
  hasAny,
  query,
  results,
  handleSelect,
}: {
  loading: boolean;
  hasAny: boolean;
  query: string;
  results: SearchResults | null;
  handleSelect: () => void;
}) {
  if (loading) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground" aria-live="polite">
        Searching…
      </div>
    );
  }
  if (!hasAny) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground" aria-live="polite">
        No results for &quot;{query.trim()}&quot;
      </div>
    );
  }
  if (!results) return null;

  return (
    <div className="py-2 max-h-[min(60vh,360px)] overflow-auto">
      {results.safes.length > 0 && (
        <section className="px-2 pb-2">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Safes
          </p>
          <ul className="space-y-0.5" role="group" aria-label="Safes">
            {results.safes.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/dashboard/safes/${s.id}`}
                  onClick={handleSelect}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-inset"
                  role="option"
                >
                  <Shield className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 truncate font-medium">
                    {s.name || truncateAddress(s.address, 8, 6)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{s.teamName}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {results.teams.length > 0 && (
        <section className="px-2 pb-2">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Teams
          </p>
          <ul className="space-y-0.5" role="group" aria-label="Teams">
            {results.teams.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/dashboard/inventory?teamId=${t.id}`}
                  onClick={handleSelect}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-inset"
                  role="option"
                >
                  <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 truncate font-medium">{t.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground font-mono">{t.slug}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {results.members.length > 0 && (
        <section className="px-2 pb-2">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Members
          </p>
          <ul className="space-y-0.5" role="group" aria-label="Members">
            {results.members.map((m) => (
              <li key={m.id}>
                <Link
                  href="/dashboard/teams?tab=members"
                  onClick={handleSelect}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-inset"
                  role="option"
                >
                  <UserCog className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 truncate font-medium">{m.name || m.email || "—"}</span>
                  {m.email && m.name && (
                    <span className="shrink-0 truncate text-xs text-muted-foreground max-w-[140px]">
                      {m.email}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {results.roles.length > 0 && (
        <section className="px-2 pb-2">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Roles
          </p>
          <ul className="space-y-0.5" role="group" aria-label="Roles">
            {results.roles.map((r) => (
              <li key={r.id}>
                <Link
                  href="/dashboard/teams?tab=roles"
                  onClick={handleSelect}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-inset"
                  role="option"
                >
                  <UserCog className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 truncate font-medium">{r.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground font-mono">{r.slug}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {results.alertRules.length > 0 && (
        <section className="px-2 pb-2">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Alert rules
          </p>
          <ul className="space-y-0.5" role="group" aria-label="Alert rules">
            {results.alertRules.map((rule) => (
              <li key={rule.id}>
                <Link
                  href={`/dashboard/alerts?highlight=${rule.id}`}
                  onClick={handleSelect}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-inset"
                  role="option"
                >
                  <Bell className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 truncate font-medium">{rule.name || rule.type}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{rule.type}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {results.nav.length > 0 && (
        <section className="border-t border-border pt-2 px-2 pb-2">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Go to
          </p>
          <ul className="space-y-0.5" role="group" aria-label="Navigation">
            {results.nav.map((item) => (
              <li key={item.href + item.label}>
                <Link
                  href={item.href}
                  onClick={handleSelect}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-inset"
                  role="option"
                >
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 truncate font-medium">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function DashboardSearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showOverlay = modalOpen || closing;

  const fetchResults = useCallback(async (q: string) => {
    if (q.length < MIN_QUERY_LENGTH) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      } else {
        setResults(null);
      }
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetchResults(query.trim());
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchResults]);

  const openModal = useCallback(() => {
    setModalOpen(true);
    setClosing(false);
    setMounted(false);
  }, []);

  const closeModal = useCallback(() => {
    if (!modalOpen && !closing) return;
    setClosing(true);
  }, [modalOpen, closing]);

  useEffect(() => {
    if (closing) {
      const t = setTimeout(() => {
        setModalOpen(false);
        setClosing(false);
        setQuery("");
        setResults(null);
        triggerRef.current?.focus();
      }, CLOSE_ANIMATION_MS);
      return () => clearTimeout(t);
    }
  }, [closing]);

  useEffect(() => {
    if (modalOpen && !closing) {
      const frame = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(frame);
    }
  }, [modalOpen, closing]);

  useEffect(() => {
    if (modalOpen && !closing) {
      modalInputRef.current?.focus();
    }
  }, [modalOpen, closing]);

  useEffect(() => {
    if (!showOverlay || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'input, a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [showOverlay]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (modalOpen || closing) {
          e.preventDefault();
          closeModal();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (modalOpen || closing) {
          closeModal();
        } else {
          openModal();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, closing, openModal, closeModal]);

  const handleSelect = useCallback(() => {
    closeModal();
  }, [closeModal]);

  const hasAny =
    results &&
    (results.safes.length > 0 ||
      results.teams.length > 0 ||
      results.members.length > 0 ||
      results.roles.length > 0 ||
      results.alertRules.length > 0 ||
      results.nav.length > 0);

  useEffect(() => {
    if (showOverlay) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showOverlay]);

  const overlay = showOverlay && typeof document !== "undefined" && (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 sm:pt-[20vh]"
      role="presentation"
    >
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-200 ease-out"
        style={{ opacity: closing ? 0 : 1 }}
        aria-hidden
        onClick={closeModal}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-dialog-title"
        aria-describedby="search-results-list"
        className="relative w-full max-w-xl rounded-xl border border-border bg-card shadow-xl transition-all duration-200 ease-out"
        style={{
          opacity: closing ? 0 : mounted ? 1 : 0,
          transform: closing ? "scale(0.98)" : mounted ? "scale(1)" : "scale(0.98)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={modalInputRef}
            id="search-dialog-title"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Convixa…"
            className="flex-1 min-w-0 bg-transparent border-0 p-0 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 text-sm"
            aria-label="Search"
            aria-controls="search-results-list"
            aria-autocomplete="list"
          />
          <kbd className="hidden shrink-0 rounded border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            ESC
          </kbd>
        </div>
        <div id="search-results-list" className="min-h-[120px]" role="region" aria-live="polite">
          <ResultsContent
            loading={loading}
            hasAny={!!hasAny}
            query={query}
            results={results}
            handleSelect={handleSelect}
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex-1 max-w-md">
        <button
          ref={triggerRef}
          type="button"
          onClick={openModal}
          className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-muted-foreground/30 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:border-primary/50"
          aria-label="Search Convixa (opens search overlay)"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1 min-w-0 truncate">Search Convixa…</span>
          <kbd className="hidden shrink-0 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            ⌘K
          </kbd>
        </button>
      </div>
      {typeof document !== "undefined" ? createPortal(overlay, document.body) : null}
    </>
  );
}
