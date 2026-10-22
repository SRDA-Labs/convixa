export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your organization and account. Hover over Settings in the sidebar to navigate sections.
        </p>
      </div>
      {children}
    </div>
  );
}
