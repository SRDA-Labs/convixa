import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TwoFactorSection } from "./two-factor-section";
import { ActiveSessionsSection } from "./active-sessions-section";
import { DeactivateSection } from "./deactivate-section";

export default async function SettingsSecurityPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Security</h1>
        <p className="text-sm text-muted-foreground">
          Protect your account and manage authentication settings.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* ---- Two-factor authentication ---- */}
        <div className="px-5 py-4 border-b border-border/40">
          <TwoFactorSection lastSignedIn={null} />
        </div>

        {/* ---- Active sessions ---- */}
        <div className="px-5 py-4 border-b border-border/40">
          <ActiveSessionsSection sessionExpires={session.expires} />
        </div>

        {/* ---- Danger zone: deactivation (blurred by default, OTP-protected) ---- */}
        <DeactivateSection />
      </div>
    </div>
  );
}
