import { cn } from "@/lib/cn";

type DashboardPageShellProps = {
  children: React.ReactNode;
  className?: string;
};

/** Canonical horizontal padding + max width for all dashboard pages. */
export const DASHBOARD_PAGE_SHELL_CLASS =
  "mx-auto w-full max-w-6xl min-w-0 px-5 sm:px-8 lg:px-10 text-[13px] leading-relaxed";

/** Centers dashboard page content with consistent padding and readable max width. */
export function DashboardPageShell({ children, className }: DashboardPageShellProps) {
  return <div className={cn(DASHBOARD_PAGE_SHELL_CLASS, className)}>{children}</div>;
}
