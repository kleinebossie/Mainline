import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Surface } from "@/components/ui/surface";
import { Wordmark } from "@/components/app-shell";
import { beginSelectedBetaSignIn } from "@/app/signin/actions";
import { prisma } from "@/db/client";
import { getPostAuthDestination } from "@/server/onboarding";
import { cn } from "@/lib/utils";

// Custom sign-in page (Auth.js `pages.signIn`). Lichess needs no secret, so it is
// always offered; Google appears only when configured.
function signInErrorCopy(code: string | undefined) {
  if (code === "AccessDenied") {
    return {
      heading: "Access denied",
      message:
        "This account could not be signed in. Please try again or use another account.",
    };
  }
  if (code === "OAuthAccountNotLinked") {
    return {
      heading: "Use the original sign-in method",
      message:
        "This email already belongs to an account created with another provider. Sign in the same way you did before.",
    };
  }
  if (code === "Configuration") {
    return {
      heading: "Sign-in is temporarily unavailable",
      message:
        "Mainline's sign-in service is not configured correctly. Try again later.",
    };
  }
  if (code) {
    return {
      heading: "Sign-in did not finish",
      message:
        "The provider did not complete sign-in. Your account is unchanged, so try again.",
    };
  }
  return null;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect(await getPostAuthDestination(prisma, session.user.id));
  }
  const params = await searchParams;
  const signInError = signInErrorCopy(params.error);

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
            Mainline is in open beta. Sign in with Lichess or Google. No
            password is ever stored.
          </p>
        </div>

        {signInError && (
          <Notice
            tone="error"
            heading={signInError.heading}
            className="mb-4"
          >
            {signInError.message}
          </Notice>
        )}

        <Surface className="p-6">
          <form action={beginSelectedBetaSignIn}>
            <div className="grid gap-3">
              <PendingSubmitButton
                name="provider"
                value="lichess"
                pendingLabel="Opening Lichess…"
                className={buttonVariants({ size: "lg", className: "w-full" })}
              >
                Continue with Lichess
              </PendingSubmitButton>
              {googleEnabled && (
                <PendingSubmitButton
                  name="provider"
                  value="google"
                  pendingLabel="Opening Google…"
                  className={buttonVariants({
                    variant: "outline",
                    size: "lg",
                    className: "w-full",
                  })}
                >
                  Continue with Google
                </PendingSubmitButton>
              )}
            </div>
          </form>

          <div className="relative my-5 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative bg-paper px-2 text-xs font-mono uppercase tracking-wider text-graphite">
              Or
            </div>
          </div>

          <Link
            href="/today"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full text-sm font-medium",
            )}
          >
            Continue as guest
          </Link>

          <p className="mt-5 border-t border-line/60 pt-4 text-center font-mono text-[0.7rem] text-graphite leading-relaxed">
            Guest mode keeps training data in your current browser. Sign in with Lichess or Google to sync across devices.
          </p>
        </Surface>
      </div>
    </main>
  );
}
