"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { SecurityTab } from "@/lib/security-access";
import { activeSecurityTab } from "@/lib/security-access";

export function SecuritySubnav({ tabs }: { tabs: SecurityTab[] }) {
  const pathname = usePathname();
  const activeHref = activeSecurityTab(pathname, tabs);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <nav className="flex flex-wrap gap-1 border-b border-border pb-3 mb-4">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            activeHref === tab.href
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
