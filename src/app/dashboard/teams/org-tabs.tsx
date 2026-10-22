"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Users, Mail, Shield, UsersRound, MessageSquare } from "lucide-react";
import { ORG_HUB_PATH } from "@/lib/org-management/constants";

export type OrgTab = "teams" | "proposals" | "members" | "invites" | "roles";

const TAB_DEFS: { key: OrgTab; label: string; icon: typeof Users }[] = [
  { key: "teams", label: "Teams", icon: UsersRound },
  { key: "proposals", label: "Proposals", icon: MessageSquare },
  { key: "members", label: "Members", icon: Users },
  { key: "invites", label: "Invites", icon: Mail },
  { key: "roles", label: "Roles", icon: Shield },
];

export function OrgTabs({ active, tabs }: { active: OrgTab; tabs: OrgTab[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function switchTab(key: OrgTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    params.delete("page");
    router.push(`${ORG_HUB_PATH}?${params.toString()}`);
  }

  const visible = TAB_DEFS.filter((t) => tabs.includes(t.key));

  return (
    <div className="flex border-b border-border overflow-x-auto">
      {visible.map(({ key, label, icon: Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => switchTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
