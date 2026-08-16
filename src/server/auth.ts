import NextAuth, { type NextAuthConfig } from "next-auth";
import type { Account } from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/db/client";
import { LichessProvider } from "@/server/auth-providers/lichess";
import { upsertPlatformConnection } from "@/server/connections";
import { admitBetaUser } from "@/server/beta-access";
import { getOnboardingStatus } from "@/server/onboarding";

// Lichess needs no secret (public PKCE client), so it is always available, even in
// CI/e2e without env. Add Google credentials to enable Google sign-in.
const providers: NextAuthConfig["providers"] = [LichessProvider()];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

// When a Lichess account is signed in or linked, mirror it into a
// PlatformConnection carrying the OAuth tokens.
async function syncLichessConnection(
  userId: string | undefined,
  account: Account | null | undefined,
  externalUsername: string | null | undefined,
): Promise<void> {
  if (!userId || account?.provider !== "lichess") return;
  const username = externalUsername ?? account.providerAccountId;
  if (!username) return;
  await upsertPlatformConnection({
    userId,
    platform: "lichess",
    externalUsername: username,
    tokens: {
      accessToken: account.access_token ?? null,
      refreshToken: account.refresh_token ?? null,
      scopes: account.scope ?? null,
    },
  });
}

async function betaAccessAllowed(
  userId: string | null | undefined,
): Promise<boolean> {
  return admitBetaUser(prisma, {
    userId,
    now: new Date(),
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true, // required for localhost/self-host (non-Vercel) deployments
  pages: { signIn: "/signin" },
  providers,
  callbacks: {
    async signIn({ user }) {
      return betaAccessAllowed(user.id);
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      if (user?.email) {
        token.email = user.email;
      }
      if (user?.name) {
        token.name = user.name;
      }
      if (user?.image) {
        token.picture = user.image;
      }
      const userId = (token.id ?? user?.id) as string | undefined;
      if (token.onboarded !== true && userId) {
        const status = await getOnboardingStatus(prisma, userId);
        token.onboarded = status.complete;
      }
      return token;
    },
    session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      if (token?.email) {
        session.user.email = token.email as string;
      }
      if (token?.name) {
        session.user.name = token.name as string;
      }
      if (token?.picture) {
        session.user.image = token.picture as string;
      }
      if (typeof token?.onboarded === "boolean") {
        session.user.onboarded = token.onboarded;
      }
      return session;
    },
  },
  events: {
    // signIn retains the raw OAuth profile after the adapter user exists, so the
    // actual allowlist claim uses the same authoritative identity as preflight.
    async signIn({ user, account, profile, isNewUser }) {
      const admitted = await betaAccessAllowed(user.id);
      if (!admitted) {
        if (isNewUser) {
          await prisma.user.delete({ where: { id: user.id } });
        }
        throw new Error("Beta access was not granted");
      }
      await syncLichessConnection(
        user.id,
        account,
        (profile as { username?: string } | undefined)?.username,
      );
    },
    // linkAccount's `profile` is the adapter user (name = Lichess username, set in
    // the provider's profile() mapping).
    async linkAccount({ user, account, profile }) {
      await syncLichessConnection(user.id, account, profile.name ?? user.name);
    },
  },
});
