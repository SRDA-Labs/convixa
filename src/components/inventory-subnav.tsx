"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  {
    href: "/dashboard/inventory",
    label: "Inventory",
    description: "All multisigs",
    icon: Archive,
    match: (pathname: string) =>
      pathname === "/dashboard/inventory" || pathname.startsWith("/dashboard/safes"),
  },
  {
    href: "/dashboard/inventory/transactions",
    label: "Transactions",
    description: "Latest activity",
    icon: ArrowLeftRight,
    match: (pathname: string) =>
      pathname.startsWith("/dashboard/inventory/transactions"),
  },
] as const;

export function InventorySubNav({ visible }: { visible: boolean }) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "absolute left-full top-0 ml-1 w-56 py-2 px-1 z-30",
        "rounded-xl border border-border bg-card shadow-xl shadow-black/10",
        "transition-all duration-200 origin-left",
        visible
          ? "opacity-100 scale-x-100 translate-x-0 pointer-events-auto"
          : "opacity-0 scale-x-95 -translate-x-2 pointer-events-none"
      )}
      aria-hidden={!visible}
      role="navigation"
      aria-label="Inventory navigation"
    >
      <div className="px-3 py-1.5 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Inventory
        </span>
      </div>

      {ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-start gap-2.5 w-full px-3 py-2 rounded-md text-xs transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset",
              active
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            )}
          >
            <item.icon
              className={cn(
                "h-3.5 w-3.5 shrink-0 mt-0.5",
                active ? "text-primary" : "text-muted-foreground"
              )}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block truncate">{item.label}</span>
              <span
                className={cn(
                  "block text-[10px] font-normal truncate",
                  active ? "text-primary/70" : "text-muted-foreground/80"
                )}
              >
                {item.description}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
