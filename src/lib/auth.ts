import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { users, accounts, otpCodes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

type OAuthProfile = { id?: string; email?: string | null; name?: string | null; image?: string | null };
type OAuthAccount = { provider: string; providerAccountId: string; access_token?: string; refresh_token?: string | null; expires_at?: number | null };

async function findOrCreateUserByOAuth(profile: OAuthProfile, account: OAuthAccount) {
  const provider = account.provider;
  const providerAccountId = account.providerAccountId;
  const email = profile.email ?? undefined;
  if (!email) return null;

  const [existingAccount] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.provider, provider), eq(accounts.providerAccountId, providerAccountId)))
    .limit(1);
  if (existingAccount) {
    const [user] = await db.select().from(users).where(eq(users.id, existingAccount.userId)).limit(1);
    return user ?? null;
  }

  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existingUser) {
    await db.insert(accounts).values({
      userId: existingUser.id,
      type: "oauth",
      provider,
      providerAccountId,
      access_token: account.access_token ?? null,
      refresh_token: account.refresh_token ?? null,
      expires_at: account.expires_at ?? null,
    });
    return existingUser;
  }

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      name: profile.name ?? null,
      image: profile.image ?? null,
      passwordHash: null,
      emailVerified: new Date(), // Google already verified
    })
    .returning();
  if (!newUser) return null;
  await db.insert(accounts).values({
    userId: newUser.id,
    type: "oauth",
    provider,
    providerAccountId,
    access_token: account.access_token ?? null,
    refresh_token: account.refresh_token ?? null,
    expires_at: account.expires_at ?? null,
  });
  return newUser;
}

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const hasGoogleProvider = Boolean(googleClientId && googleClientSecret);

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 }, // 7 days (reduced from 30 for security)
  pages: { signIn: "/login" },
  providers: [
    ...(hasGoogleProvider
      ? [
          GoogleProvider({
            clientId: googleClientId!,
            clientSecret: googleClientSecret!,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        loginToken: { label: "Login token", type: "text" },
      },
      async authorize(credentials) {
        const loginToken = credentials?.loginToken;
        if (loginToken) {
          const [row] = await db
            .select()
            .from(otpCodes)
            .where(and(eq(otpCodes.code, loginToken), eq(otpCodes.purpose, "login_token")))
            .limit(1);
          if (!row || new Date(row.expiresAt) <= new Date()) {
            if (row) await db.delete(otpCodes).where(eq(otpCodes.id, row.id));
            return null;
          }
          const [user] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
          await db.delete(otpCodes).where(eq(otpCodes.id, row.id));
          if (!user) return null;
          return {
            id: user.id,
            email: user.email!,
            name: user.name ?? undefined,
            image: user.image ?? undefined,
          };
        }
        if (!credentials?.email || !credentials?.password) return null;
        // Brute-force protection: rate limit login attempts (audit finding I4)
        const { checkLoginRateLimit } = await import("@/lib/rate-limit");
        const rl = checkLoginRateLimit(credentials.email);
        if (!rl.ok) {
          console.warn(`[auth] Login rate limit exceeded for ${credentials.email}`);
          return null;
        }
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email))
          .limit(1);
        if (!user?.passwordHash) return null;
        if (user.twoFactorEnabled === true) return null;
        const ok = await compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email!,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Tunnel testing: set NEXT_PUBLIC_APP_BASE_URL to tunnel URL (e.g. https://xxx.trycloudflare.com) so logout/redirects use it. Remove for rollback.
      const appUrl = (process.env.NEXT_PUBLIC_APP_BASE_URL || process.env.APP_URL || process.env.NEXTAUTH_URL || baseUrl).replace(/\/$/, "");
      if (url.startsWith("/")) return `${appUrl}${url}`;
      try {
        const parsed = new URL(url);
        const appOrigin = new URL(appUrl).origin;
        if (parsed.origin === appOrigin) return url;
        // Same host, different port (e.g. dev: client on 3001, NEXTAUTH_URL 3000): preserve callback URL so logout stays on correct port
        if (parsed.hostname === new URL(appUrl).hostname && (parsed.pathname === "/" || parsed.pathname === "/login")) {
          return url;
        }
      } catch {
        // ignore
      }
      return appUrl;
    },
    async jwt({ token, user, account, trigger, session }) {
      // Allow client-side session updates (e.g. activeOrganizationId change, name change)
      if (trigger === "update") {
        if (session?.activeOrganizationId !== undefined) {
          token.activeOrganizationId = session.activeOrganizationId;
        }
        if (session?.name !== undefined) {
          token.name = session.name;
        }
      }
      if (user) {
        if (account && "provider" in account && "providerAccountId" in account) {
          const dbUser = await findOrCreateUserByOAuth(
            user as OAuthProfile,
            account as OAuthAccount
          );
          if (dbUser) {
            token.id = dbUser.id;
            token.email = dbUser.email ?? undefined;
            token.name = dbUser.name ?? null;
            token.picture = dbUser.image ?? null;
          }
        } else {
          token.id = user.id;
          token.email = user.email ?? undefined;
          token.name = user.name ?? null;
          token.picture = user.image ?? null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as { id: string; email?: string | null; name?: string | null; image?: string | null; activeOrganizationId?: string | null };
        u.id = token.id as string;
        u.email = token.email;
        u.name = token.name ?? null;
        u.image = token.picture ?? null;
        u.activeOrganizationId = token.activeOrganizationId;
      }
      return session;
    },
  },
};

export type SessionUser = { id: string; email?: string | null; name?: string | null; image?: string | null };
