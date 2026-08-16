// Expose the DB user id and onboarding status on the session.
// This allows fast layout gating without extra database queries.
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      onboarded?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    onboarded?: boolean;
  }
}
