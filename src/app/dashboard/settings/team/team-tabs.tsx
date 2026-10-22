"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Users, Mail, Shield } from "lucide-react";

type Tab = "members" | "invites" | "roles";

const TAB_DEFS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: "members", label: "Members", icon: Users },
  { key: "invites", label: "Invites", icon: Mail },
  { key: "roles", label: "Roles", icon: Shield },
];

export function TeamTabs({ active, tabs }: { active: Tab; tabs: Tab[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function switchTab(key: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    params.delete("page");
    router.push(`/dashboard/settings/team?${params.toString()}`);
  }

  const visible = TAB_DEFS.filter((t) => tabs.includes(t.key));

  return (
    <div className="flex border-b border-border/60">
      {visible.map(({ key, label, icon: Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => switchTab(key)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[11px] font-semibold transition-colors border-b-2 -mb-px ${
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <Icon className="h-3 w-3" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
