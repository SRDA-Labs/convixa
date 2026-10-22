import { OobCasesClient } from "./oob-cases-client";

export const dynamic = "force-dynamic";

export default function OobCasesPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">OOB verification cases</h1>
        <p className="text-sm text-muted-foreground">
          Out-of-band verification for critical governance and admin changes
        </p>
      </header>
      <OobCasesClient />
    </div>
  );
}
