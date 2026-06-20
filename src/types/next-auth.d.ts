// Expose the DB user id on the session (set in the `session` callback, BUILD.md
// uses it for per-user tRPC procedures). With the database session strategy the
// adapter user always has an id.
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
