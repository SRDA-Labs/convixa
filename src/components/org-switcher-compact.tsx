"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/cn";

export type OrgOption = { orgId: string; orgName: string; role: string };

export function OrgSwitcherCompact({
  currentOrgId,
  currentOrgName,
  orgs,
}: {
  currentOrgId: string;
  currentOrgName: string;
  orgs: OrgOption[];
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function switchOrg(orgId: string) {
    if (orgId === currentOrgId) { setOpen(false); return; }
    startTransition(async () => {
      await fetch("/api/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      setOpen(false);
      router.push("/dashboard");
      router.refresh();
    });
  }

  const initials = currentOrgName.slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        aria-expanded={open}
        aria-label="Switch organization"
      >
        <span
          className="size-5 rounded bg-primary text-primary-foreground inline-flex items-center justify-center text-[10px] font-bold shrink-0"
          aria-hidden
        >
          {initials}
        </span>
        <span className="truncate max-w-[160px] font-semibold">{currentOrgName}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-64 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border-subtle">
            Switch organization
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {orgs.map((org) => {
              const active = org.orgId === currentOrgId;
              return (
                <button
                  key={org.orgId}
                  type="button"
                  onClick={() => switchOrg(org.orgId)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                    active
                      ? "bg-primary/10 text-foreground font-medium"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  )}
                >
                  <span className="flex-1 truncate">{org.orgName}</span>
                  <span className="shrink-0 text-[10px] text-text-tertiary capitalize">{org.role}</span>
                  {active && <Check className="h-3 w-3 shrink-0 text-primary" aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
