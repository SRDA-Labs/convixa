"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, LayoutGroup, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

export type PageTab = { href: string; label: string; matchPrefix?: boolean };
export type PageTabGroup = { label?: string; tabs: PageTab[] };

export function PageTabs({
  tabs,
  groups,
  className,
}: {
  tabs?: PageTab[];
  groups?: PageTabGroup[];
  className?: string;
}) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();

  const renderTab = (tab: PageTab) => {
    const active = tab.matchPrefix
      ? pathname.startsWith(tab.href)
      : pathname === tab.href;
    return (
      <Link
        key={tab.href}
        href={tab.href}
        role="tab"
        aria-selected={active}
        className={cn(
          "relative px-3 py-2 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          active
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {tab.label}
        {active && (
          <motion.div
            layoutId={shouldReduceMotion ? undefined : "activeTab"}
            className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
      </Link>
    );
  };

  const renderSeparator = (key: string) => (
    <div
      key={key}
      className="w-px h-5 bg-border self-center mx-1"
      aria-hidden="true"
    />
  );

  // Use groups if provided, otherwise fall back to flat tabs
  const groupsToRender: PageTabGroup[] = groups ?? (tabs ? [{ tabs }] : []);

  const allTabs: (PageTab | { _separator: true; _key: string })[] = [];
  groupsToRender.forEach((group, gi) => {
    if (gi > 0) {
      allTabs.push({ _separator: true, _key: `sep-${gi}` });
    }
    group.tabs.forEach((tab) => allTabs.push(tab));
  });

  return (
    <LayoutGroup>
      <div className={cn("border-b border-border-subtle flex items-end gap-1", className)} role="tablist">
        {allTabs.map((item) => {
          if ("_separator" in item) {
            return renderSeparator(item._key);
          }
          return renderTab(item);
        })}
      </div>
    </LayoutGroup>
  );
}
