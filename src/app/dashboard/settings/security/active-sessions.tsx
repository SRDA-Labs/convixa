"use client";

import { Monitor, Smartphone, Clock } from "lucide-react";

function getDeviceInfo(): { icon: typeof Monitor; label: string; os: string; browser: string } {
  if (typeof window === "undefined") {
    return { icon: Monitor, label: "Unknown", os: "Unknown", browser: "Unknown" };
  }

  const ua = window.navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(ua);
  const isMac = /Mac/i.test(ua);
  const isWindows = /Windows/i.test(ua);
  const isLinux = /Linux/i.test(ua) && !/Android/i.test(ua);

  let os = "Unknown";
  if (isMac) os = "macOS";
  else if (isWindows) os = "Windows";
  else if (isLinux) os = "Linux";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";

  let browser = "Unknown";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome/i.test(ua) && !/Edg\//i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Firefox/i.test(ua)) browser = "Firefox";

  return {
    icon: isMobile ? Smartphone : Monitor,
    label: isMobile ? "Mobile" : "Desktop",
    os,
    browser,
  };
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function getRelativeExpiry(expiresStr: string): string {
  try {
    const now = Date.now();
    const expires = new Date(expiresStr).getTime();
    const diffMs = expires - now;

    if (diffMs <= 0) return "Expired";

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `Expires in ${days}d`;
    if (hours > 0) return `Expires in ${hours}h`;
    if (minutes > 0) return `Expires in ${minutes}m`;
    return "Expiring soon";
  } catch {
    return "";
  }
}

export function ActiveSessions({ sessionExpires, hideHeading }: { sessionExpires: string; hideHeading?: boolean }) {
  const device = getDeviceInfo();
  const relativeExpiry = getRelativeExpiry(sessionExpires);
  const fullDate = formatDate(sessionExpires);

  return (
    <section aria-labelledby="sessions-heading" id="sessions" className="space-y-1">
      {!hideHeading && (
        <>
          <h3 id="sessions-heading" className="text-sm font-medium text-foreground">Active sessions</h3>
          <p className="text-xs text-muted-foreground">Devices currently signed in to your account</p>
        </>
      )}
      <div className={!hideHeading ? "mt-4 space-y-2" : "space-y-2"}>
        <div className="rounded-lg bg-muted/30 p-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-muted shrink-0">
                <device.icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {device.os} &middot; {device.browser}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden />
                  <span className="text-[11px] text-muted-foreground">Current session</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground shrink-0">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden />
                <span>{relativeExpiry}</span>
              </span>
              <span className="text-[10px] text-muted-foreground/60" title={fullDate}>
                {fullDate}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
