import { redirect } from "next/navigation";

import { auth, signIn } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/app-shell";

// Custom sign-in page (Auth.js `pages.signIn`). Lichess needs no secret, so it is
// always offered; Google appears only when configured.
export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/connections");

  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="settle w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Wordmark className="text-base" />
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Sign in
          </h1>
          <p className="text-graphite text-sm leading-relaxed">
            Connect a chess account and Mainline builds your training program
            from your real games — no password is ever stored.
          </p>
        </div>

        <div className="bg-card rounded-lg border p-6 shadow-sheet">
          <form
            action={async () => {
              "use server";
              await signIn("lichess", { redirectTo: "/connections" });
            }}
          >
            <Button type="submit" size="lg" className="w-full">
              Continue with Lichess
            </Button>
          </form>

          {googleEnabled && (
            <form
              className="mt-3"
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/connections" });
              }}
            >
              <Button
                type="submit"
                variant="outline"
                size="lg"
                className="w-full"
              >
                Continue with Google
              </Button>
            </form>
          )}

          <p className="text-graphite mt-5 border-t border-line/80 pt-4 text-center font-mono text-[0.7rem] leading-relaxed">
            Read-only access. Your games and outcomes are yours — exportable and
            deletable at any time.
          </p>
        </div>
      </div>
    </main>
  );
}
