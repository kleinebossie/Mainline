import NextAuth, { type NextAuthConfig } from "next-auth";
import type { Account } from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { cookies } from "next/headers";

import { prisma } from "@/db/client";
import { LichessProvider } from "@/server/auth-providers/lichess";
import { upsertPlatformConnection } from "@/server/connections";
import {
  admitBetaUser,
  BETA_INVITE_COOKIE,
  ownerEmailsFromEnv,
} from "@/server/beta-access";

// Lichess needs no secret (public PKCE client), so it is always available — even in
// CI/e2e without env. Google is wired only when its credentials are present, so
// `next build` and the smoke e2e run without secrets. Add GOOGLE_CLIENT_ID/SECRET
// (.env.local) to enable Google sign-in (M0 DoD).
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
// PlatformConnection carrying the OAuth tokens (M1 DoD). Idempotent (upsert), so it
// is safe to run from both the linkAccount and signIn events (the two fire across
// first-link and returning sign-ins). `externalUsername` is resolved by the caller
// because the two events expose it differently (OAuth profile vs. adapter user).
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  trustHost: true, // required for localhost/self-host (non-Vercel) deployments
  pages: { signIn: "/signin" },
  providers,
  callbacks: {
    async signIn({ user }) {
      const cookieStore = await cookies();
      const inviteCode = cookieStore.get(BETA_INVITE_COOKIE)?.value;
      const admitted = await admitBetaUser(prisma, {
        userId: user.id,
        email: user.email,
        inviteCode,
        now: new Date(),
        ownerEmails: ownerEmailsFromEnv(),
      });
      return admitted;
    },
    session({ session, user }) {
      // Database strategy: `user` is the adapter row, always has an id.
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      const cookieStore = await cookies();
      const inviteCode = cookieStore.get(BETA_INVITE_COOKIE)?.value;
      const admitted = await admitBetaUser(prisma, {
        userId: user.id,
        email: user.email,
        inviteCode,
        now: new Date(),
        ownerEmails: ownerEmailsFromEnv(),
      });
      if (!admitted) {
        await prisma.user.delete({ where: { id: user.id } });
        throw new Error("Closed beta access was not granted");
      }
    },
    // linkAccount's `profile` is the adapter user (name = Lichess username, set in
    // the provider's profile() mapping).
    async linkAccount({ user, account, profile }) {
      await syncLichessConnection(user.id, account, profile.name ?? user.name);
    },
    // signIn's `profile` is the raw OAuth profile (has `username`).
    async signIn({ user, account, profile }) {
      await syncLichessConnection(
        user.id,
        account,
        (profile as { username?: string } | undefined)?.username,
      );
    },
  },
});
