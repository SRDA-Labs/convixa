import { PageTabs } from "@/components/page-tabs";

export default async function ControlsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Controls</h1>
        <p className="text-xs text-muted-foreground mt-1">Alert subscription lists, on-chain address books, policies, and on-chain policy.</p>
      </div>
      <PageTabs tabs={[
        { href: "/dashboard/controls/lists",           label: "Lists",             matchPrefix: true },
        { href: "/dashboard/controls/policies",         label: "Policies",        matchPrefix: true },
        { href: "/dashboard/controls/on-chain-policy",  label: "On-chain policy", matchPrefix: true },
      ]} />
      {children}
    </div>
  );
}
