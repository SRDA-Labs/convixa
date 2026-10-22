import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentUser, getDefaultOrgId, getCurrentUserOrgs, getOrgName, isOrgAdmin } from "@/lib/auth-server";
import { OrgNameForm } from "./org-name-form";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { UnifiedProfileForm } from "./unified-profile-form";
import { PreferencesSection } from "./preferences-section";
import { MyWalletsSection } from "./my-wallets-section";
import { DeleteOrgButton } from "@/components/delete-org-button";
import { Shield, Calendar } from "lucide-react";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export default async function SettingsGeneralPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const currentUser = await getCurrentUser();
  if (!currentUser?.id) return null;

  const [profile] = await db
    .select({
      name: users.name,
      email: users.email,
      image: users.image,
      timezone: users.timezone,
      linkedWalletAddress: users.linkedWalletAddress,
      preferences: users.preferences,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, currentUser.id))
    .limit(1);

  if (!profile) return null;

  // Get role and joinedAt in default org
  const orgId = await getDefaultOrgId();
  let role: string | null = null;
  let joinedAt: string | null = null;
  let orgName: string | null = null;
  let canEditOrg = false;

  if (orgId) {
    const orgs = await getCurrentUserOrgs();
    const membership = orgs.find((o) => o.orgId === orgId);
    if (membership) {
      role = membership.role;
      joinedAt = membership.joinedAt?.toISOString?.() ?? null;
      orgName = membership.orgName;
    }
    canEditOrg = await isOrgAdmin(orgId);
    if (!orgName) {
      orgName = await getOrgName(orgId);
    }
  }

  const displayName = profile.name || "Unnamed User";
  const initials = (profile.name || profile.email || "?")
    .split(/[ @.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="w-full space-y-4">
      <header className="space-y-0.5">
        <h1 className="text-lg font-bold tracking-tight text-foreground">General</h1>
        <p className="text-xs text-muted-foreground">
          Manage your identity, wallet, and account preferences.
        </p>
      </header>

      {/* Identity snapshot — outside the form, gives immediate context */}
      <div className="flex items-center gap-3 px-0.5">
        {profile.image ? (
          <img
            src={profile.image}
            alt=""
            className="h-8 w-8 rounded-full object-cover ring-1 ring-primary/10 shrink-0"
          />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10">
            <span className="text-xs font-bold tracking-tight text-primary">
              {initials}
            </span>
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h2 className="text-sm font-semibold text-foreground truncate">
              {displayName}
            </h2>
            {role && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0 text-[10px] font-medium text-muted-foreground shrink-0">
                <Shield className="h-2.5 w-2.5" aria-hidden />
                {capitalize(role)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
            {profile.email && <span className="truncate">{profile.email}</span>}
            {joinedAt && (
              <span className="inline-flex items-center gap-1 shrink-0">
                <Calendar className="h-2.5 w-2.5" aria-hidden />
                Member since {formatDate(joinedAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      {orgId && canEditOrg && orgName && (
        <OrgNameForm orgId={orgId} initialName={orgName} />
      )}

      {/* One unified flowing form */}
      <UnifiedProfileForm
        initialName={profile.name ?? null}
        email={profile.email ?? null}
        initialTimezone={profile.timezone ?? "UTC"}
        initialImage={profile.image ?? null}
        linkedWalletAddress={profile.linkedWalletAddress ?? null}
      />

      {/* Preferences section */}
      <PreferencesSection
        initialPreferences={((profile.preferences as Record<string, unknown>) ?? {
          theme: "dark",
          currency: "USD",
          dateFormat: "MM/DD/YYYY",
          compactMode: false,
        }) as {
          theme: "light" | "dark" | "system";
          currency: string;
          dateFormat: string;
          compactMode: boolean;
        }}
      />

      {/* My Wallets section */}
      <section className="rounded-md border border-border/60 bg-card overflow-hidden shadow-sm">
        <div className="px-3.5 py-2.5 border-b border-border/40">
          <h3 className="text-[11px] font-semibold text-foreground">My Wallets</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Manage your linked wallet addresses, labels, and primary wallet.
          </p>
        </div>
        <div className="px-3.5 py-2.5">
          <MyWalletsSection />
        </div>
      </section>

      {orgId && <DeleteOrgButton orgId={orgId} />}
    </div>
  );
}
