"use client";

import { UserPlus, UserMinus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ProposeTemplate } from "../types";
import { templateLabel } from "../types";

const TEMPLATES: {
  id: ProposeTemplate;
  description: string;
  icon: typeof UserPlus;
}[] = [
  {
    id: "add",
    description: "Propose adding a new owner to one or more Safes",
    icon: UserPlus,
  },
  {
    id: "remove",
    description: "Propose removing an owner from selected Safes",
    icon: UserMinus,
  },
  {
    id: "rotate",
    description: "Propose swapping an old owner for a new one (swapOwner)",
    icon: RefreshCw,
  },
];

export function TemplateStep({
  selected,
  onSelect,
}: {
  selected: ProposeTemplate | null;
  onSelect: (t: ProposeTemplate) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Choose an owner-management template. You will propose a transaction per Safe — Convixa does
        not execute it.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {TEMPLATES.map((t) => {
          const active = selected === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted/40"
              )}
            >
              <t.icon
                className={cn(
                  "h-5 w-5",
                  active ? "text-primary" : "text-muted-foreground"
                )}
                aria-hidden
              />
              <span className="text-sm font-medium text-foreground">
                {templateLabel(t.id)}
              </span>
              <span className="text-xs text-muted-foreground">{t.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
