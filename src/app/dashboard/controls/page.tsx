import { getDefaultOrgId } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { List, Shield, FileCode } from "lucide-react";

export default async function ControlsPage() {
  const orgId = await getDefaultOrgId();
  if (!orgId) redirect("/dashboard");

  const sections = [
    {
      href: "/dashboard/controls/lists",
      title: "Lists",
      description: "Alert subscription lists (org members) and on-chain address books (named vendors & counterparties).",
      icon: List,
    },
    {
      href: "/dashboard/controls/policies",
      title: "Policies",
      description: "Trigger, condition, and action rules for transaction blocking and alerting.",
      icon: Shield,
    },
    {
      href: "/dashboard/controls/on-chain-policy",
      title: "On-chain policy",
      description: "On-chain policy configuration.",
      icon: FileCode,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sections.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col rounded-xl border border-border bg-card p-6 text-left transition-colors hover:bg-muted/30 hover:border-primary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            <Icon className="h-8 w-8 text-primary" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </Link>
        ))}
      </div>
  );
}
