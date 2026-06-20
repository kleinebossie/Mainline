import { redirect } from "next/navigation";

import { auth, signIn } from "@/server/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Custom sign-in page (Auth.js `pages.signIn`). Lichess needs no secret, so it is
// always offered; Google appears only when configured.
export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/connections");

  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>
            Connect your chess account to build your training program.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form
            action={async () => {
              "use server";
              await signIn("lichess", { redirectTo: "/connections" });
            }}
          >
            <Button type="submit" className="w-full">
              Continue with Lichess
            </Button>
          </form>

          {googleEnabled && (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/connections" });
              }}
            >
              <Button type="submit" variant="outline" className="w-full">
                Continue with Google
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
