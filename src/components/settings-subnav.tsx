"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Fingerprint,
  Ban,
  UserRoundCog,
} from "lucide-react";
import { cn } from "@/lib/cn";

export type SettingsCategory = {
  label: string;
  href?: string;
  icon?: typeof User;
  items?: SettingsNavItem[];
};

export type SettingsNavItem = {
  href: string;
  label: string;
  icon: typeof User;
  description?: string;
};

function getSettingsCategories(): SettingsCategory[] {
  return [
    {
      label: "General",
      href: "/dashboard/settings/general",
      icon: User,
    },
    {
      label: "Security",
      href: "/dashboard/settings/security",
      icon: Fingerprint,
    },
    {
      label: "Organization",
      items: [
        {
          href: "/dashboard/teams",
          label: "Teams & users",
          icon: UserRoundCog,
          description: "Teams, members, invites, and multisigs",
        },
        {
          href: "/dashboard/settings/blacklisted-addresses",
          label: "Blacklisted",
          icon: Ban,
          description: "Manage blocked wallet addresses",
        },
      ],
    },
  ];
}

export function SettingsSubNav({ visible }: { visible: boolean }) {
  const pathname = usePathname();
  const [currentHash, setCurrentHash] = useState("");
  const categories = getSettingsCategories();

  useEffect(() => {
    setCurrentHash(window.location.hash);
    const onHashChange = () => setCurrentHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [pathname]);

  const isActive = (href: string) => {
    const [basePath, hash] = href.split("#");
    const linkHash = hash ? `#${hash}` : "";

    if (basePath === "/dashboard/settings") return false;

    // Teams hub moved out of settings
    if (basePath === "/dashboard/teams") {
      return pathname === "/dashboard/teams" || pathname.startsWith("/dashboard/teams/");
    }

    // Path must match first
    if (!pathname.startsWith(basePath)) return false;

    // If the link has a hash, it's only active when the current URL has that exact hash
    if (linkHash) return currentHash === linkHash;

    // If the link has NO hash, it's only active when the current URL has NO hash
    return currentHash === "";
  };

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
      aria-label="Settings navigation"
    >
      <div className="px-3 py-1.5 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Settings
        </span>
      </div>

      {categories.map((category, catIdx) => (
        <div key={category.label}>
          {catIdx > 0 && (
            <div className="mx-3 my-1.5 h-px bg-border-subtle" aria-hidden />
          )}
          {category.href ? (
            <Link
              href={category.href}
              className={cn(
                "flex items-center gap-2.5 w-full px-3 py-1.5 rounded-md text-xs transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset",
                isActive(category.href)
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              {category.icon && (
                <category.icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    isActive(category.href) ? "text-primary" : "text-muted-foreground"
                  )}
                  aria-hidden
                />
              )}
              <span className="truncate">{category.label}</span>
            </Link>
          ) : (
            <>
              <div className="px-3 py-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary">
                  {category.label}
                </span>
              </div>
              {category.items?.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-1.5 rounded-md text-xs transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset",
                    isActive(item.href)
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      isActive(item.href) ? "text-primary" : "text-muted-foreground"
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              ))}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
