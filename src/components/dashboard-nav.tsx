"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Gauge,
  Archive,
  LogOut,
  Bell,
  Settings,
  Users,
  ShieldCheck,
  Wallet,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { SettingsSubNav } from "@/components/settings-subnav";
import { InventorySubNav } from "@/components/inventory-subnav";
import type { DashboardNavVisibility } from "@/lib/dashboard-nav-access";
import {
  hasOrganizationNavItems,
  hasSignerNavItems,
} from "@/lib/dashboard-nav-access";

export type OrgOption = {
  orgId: string;
  orgName: string;
  role: string;
};

function RailIcon({
  href,
  icon: Icon,
  label,
  active,
  badge,
}: {
  href: string;
  icon: typeof Gauge;
  label: string;
  active: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={cn(
        "relative size-10 rounded-lg inline-flex items-center justify-center transition-colors duration-200",
        "group-hover:w-full group-hover:justify-start group-hover:px-3",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "bg-primary/12 text-primary"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      <span className="hidden group-hover:inline text-xs font-medium ml-3 truncate">
        {label}
      </span>
      {badge && (
        <span className="absolute top-1 right-1 min-w-[16px] h-[14px] px-1 inline-flex items-center justify-center rounded-full bg-warning text-background text-[9px] font-bold leading-none group-hover:static group-hover:ml-auto group-hover:min-w-[20px] group-hover:h-[18px] group-hover:text-[10px]">
          {badge}
        </span>
      )}
    </Link>
  );
}

function NavSectionDivider({ label }: { label: string }) {
  return (
    <div className="w-full pt-2 pb-1" role="presentation">
      <div
        className="mx-auto h-px w-5 bg-border-subtle transition-all duration-200 group-hover:mx-1.5 group-hover:w-[calc(100%-12px)]"
        aria-hidden
      />
      <p className="hidden group-hover:block px-3 pt-2 pb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/55 select-none truncate">
        {label}
      </p>
    </div>
  );
}

export function DashboardNav({
  orgName: _orgName,
  currentOrgId: _currentOrgId,
  orgs: _orgs,
  teamNames: _teamNames,
  navVisibility,
}: {
  orgName?: string | null;
  currentOrgId?: string;
  orgs?: OrgOption[];
  teamNames?: string[];
  navVisibility: DashboardNavVisibility;
}) {
  const pathname = usePathname();
  const [alertsFiringCount, setAlertsFiringCount] = useState(0);
  const [settingsHovered, setSettingsHovered] = useState(false);
  const [inventoryHovered, setInventoryHovered] = useState(false);
  const settingsContainerRef = useRef<HTMLDivElement>(null);
  const inventoryContainerRef = useRef<HTMLDivElement>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inventoryLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { organization, signer } = navVisibility;
  const showOrgSection = hasOrganizationNavItems(navVisibility);
  const showSignerSection = hasSignerNavItems(navVisibility);

  const handleSettingsEnter = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setSettingsHovered(true);
  }, []);

  const handleSettingsLeave = useCallback(() => {
    leaveTimerRef.current = setTimeout(() => {
      setSettingsHovered(false);
    }, 150);
  }, []);

  const handleInventoryEnter = useCallback(() => {
    if (inventoryLeaveTimerRef.current) {
      clearTimeout(inventoryLeaveTimerRef.current);
      inventoryLeaveTimerRef.current = null;
    }
    setInventoryHovered(true);
  }, []);

  const handleInventoryLeave = useCallback(() => {
    inventoryLeaveTimerRef.current = setTimeout(() => {
      setInventoryHovered(false);
    }, 150);
  }, []);

  useEffect(() => {
    if (!pathname.startsWith("/dashboard")) return;
    if (!organization.alerts) return;
    fetch("/api/alerts/status")
      .then((res) => (res.ok ? res.json() : { firing: [] }))
      .then((data: { firing?: unknown[] }) =>
        setAlertsFiringCount(data.firing?.length ?? 0)
      )
      .catch(() => {});
  }, [pathname, organization.alerts]);

  const isActive = (href: string) =>
    pathname === href ||
    (href === "/dashboard/settings" && pathname.startsWith("/dashboard/settings")) ||
    (href === "/dashboard/inventory" &&
      (pathname.startsWith("/dashboard/inventory") || pathname.startsWith("/dashboard/safes"))) ||
    (href === "/dashboard/teams" && pathname.startsWith("/dashboard/teams")) ||
    (href === "/dashboard/controls" && pathname.startsWith("/dashboard/controls")) ||
    (href === "/dashboard/signer-queue" && pathname.startsWith("/dashboard/signer-queue")) ||
    (href === "/dashboard/security/readiness" && pathname.startsWith("/dashboard/security"));

  return (
    <nav
      className="flex flex-col items-center group-hover:items-stretch gap-1 px-1.5 py-3 flex-1 min-h-0"
      aria-label="Dashboard navigation"
    >
      {showOrgSection && (
        <div className="flex flex-col items-center group-hover:items-stretch gap-1 w-full">
          <NavSectionDivider label="Organization" />
          {organization.dashboard && (
            <RailIcon
              href="/dashboard"
              icon={Gauge}
              label="Dashboard"
              active={isActive("/dashboard")}
            />
          )}
          {organization.inventory && (
            <div
              ref={inventoryContainerRef}
              className="relative w-full flex justify-center group-hover:justify-stretch"
              onMouseEnter={handleInventoryEnter}
              onMouseLeave={handleInventoryLeave}
            >
              <RailIcon
                href="/dashboard/inventory"
                icon={Archive}
                label="Inventory"
                active={isActive("/dashboard/inventory")}
              />
              <InventorySubNav visible={inventoryHovered} />
            </div>
          )}
          {organization.alerts && (
            <RailIcon
              href="/dashboard/alerts"
              icon={Bell}
              label="Alerts"
              active={isActive("/dashboard/alerts")}
              badge={alertsFiringCount > 0 ? alertsFiringCount : undefined}
            />
          )}
          {organization.teams && (
            <RailIcon
              href="/dashboard/teams"
              icon={Users}
              label="Teams"
              active={isActive("/dashboard/teams")}
            />
          )}
          {organization.controls && (
            <RailIcon
              href="/dashboard/controls"
              icon={ShieldCheck}
              label="Controls"
              active={isActive("/dashboard/controls")}
            />
          )}
          {organization.security && (
            <RailIcon
              href="/dashboard/security/readiness"
              icon={Shield}
              label="Security"
              active={isActive("/dashboard/security/readiness")}
            />
          )}
        </div>
      )}

      {showSignerSection && (
        <div className="flex flex-col items-center group-hover:items-stretch gap-1 w-full">
          <NavSectionDivider label="Signer" />
          {signer.queue && (
            <RailIcon
              href="/dashboard/signer-queue"
              icon={Wallet}
              label="Signer Queue"
              active={pathname.startsWith("/dashboard/signer-queue")}
            />
          )}
        </div>
      )}

      <div className="flex flex-col items-center group-hover:items-stretch gap-1 w-full mt-auto">
        <NavSectionDivider label="Account" />
        <div
          ref={settingsContainerRef}
          className="relative w-full flex justify-center group-hover:justify-stretch"
          onMouseEnter={handleSettingsEnter}
          onMouseLeave={handleSettingsLeave}
        >
          <RailIcon
            href="/dashboard/settings"
            icon={Settings}
            label="Settings"
            active={isActive("/dashboard/settings")}
          />
          <SettingsSubNav visible={settingsHovered} />
        </div>

        <div className="pb-2 w-full flex justify-center group-hover:justify-stretch group-hover:px-0">
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/revoke-sessions", { method: "POST" }).catch(() => {});
              signOut({ callbackUrl: "/" });
            }}
            title="Sign out"
            aria-label="Sign out"
            className="size-10 group-hover:w-full group-hover:justify-start group-hover:px-3 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden />
            <span className="hidden group-hover:inline text-xs font-medium ml-3">Sign out</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
