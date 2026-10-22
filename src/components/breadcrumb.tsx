"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const PATH_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  inventory: "Inventory",
  transactions: "Transactions",
  safes: "Safes",
  alerts: "Alerts",
  teams: "Teams",
  proposals: "Proposals",
  list: "Teams",
  invites: "Invites",
  roles: "Roles",
  controls: "Controls",
  lists: "Lists",
  policies: "Policies",
  "on-chain-policy": "On-chain policy",
  settings: "Settings",
  members: "Members",
  activity: "Activity",
  security: "Security",
  incidents: "Incidents",
  discussion: "Discussion",
  "signer-queue": "Signer Queue",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Safe tx hashes and other long opaque path segments. */
const OPAQUE_ID_RE = /^(0x)?[a-fA-F0-9]{32,}$/i;

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function isUuid(segment: string): boolean {
  return UUID_RE.test(segment);
}

function isOpaqueId(segment: string): boolean {
  return isUuid(segment) || OPAQUE_ID_RE.test(segment);
}

function shouldSkipSegment(
  segment: string,
  prev?: string,
  next?: string
): boolean {
  // Hide raw tx hashes in /safes/.../pending/{hash}/...
  if (OPAQUE_ID_RE.test(segment) && !isUuid(segment)) return true;

  // Hide "pending" folder when it only wraps a tx hash
  if (segment === "pending" && next && isOpaqueId(next)) return true;

  return false;
}

function resolveLabel(segment: string, prev?: string): string {
  if (PATH_LABELS[segment]) return PATH_LABELS[segment];

  if (isUuid(segment)) {
    if (prev === "safes") return "Safe";
    if (prev === "proposals") return "Discussion";
    if (prev === "lists" || prev === "policies" || prev === "incidents") return "Details";
    return "Details";
  }

  if (segment.length > 24) {
    return "Details";
  }

  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

function buildCrumbs(segments: string[]): { href: string; label: string }[] {
  const crumbs: { href: string; label: string }[] = [];

  for (let i = 0; i < segments.length; i++) {
    const raw = segments[i];
    const segment = decodeSegment(raw);
    const prev = i > 0 ? decodeSegment(segments[i - 1]) : undefined;
    const next =
      i < segments.length - 1 ? decodeSegment(segments[i + 1]) : undefined;

    if (shouldSkipSegment(segment, prev, next)) continue;

    const href = "/" + segments.slice(0, i + 1).join("/");
    crumbs.push({ href, label: resolveLabel(segment, prev) });
  }

  return crumbs;
}

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = buildCrumbs(segments);

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-text-tertiary" aria-hidden />}
            {isLast ? (
              <span className="truncate font-medium text-foreground">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="truncate hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
