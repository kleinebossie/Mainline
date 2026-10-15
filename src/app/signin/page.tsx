import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { buttonVariants } from "@/components/ui/button";
import { ErrorNotice } from "@/components/ui/error-notice";
import { GuestLandingButton } from "@/components/guest-landing-button";
import { Wordmark } from "@/components/app-shell";
import { beginSelectedBetaSignIn } from "@/app/signin/actions";
import { prisma } from "@/db/client";
import { getPostAuthDestination } from "@/server/onboarding";

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
    <main className="bg-paper flex min-h-screen items-center justify-center p-5">
      <div className="settle w-full max-w-[26rem]">
        <Wordmark className="text-[1.15rem]" />

        <h1 className="mt-10 text-[2.1rem] leading-none">
          Sign in to Mainline
        </h1>
        <p className="font-serif mt-2.5 text-[0.98rem] leading-relaxed text-graphite">
          Mainline is in open beta. Sign in with the account your games are
          already on. No password is stored.
        </p>

        {signInError && (
          <ErrorNotice
            className="mt-5"
            heading={signInError.heading}
            message={signInError.message}
          />
        )}

        <form
          action={beginSelectedBetaSignIn}
          className="sheet mt-6 flex flex-col gap-3 p-5"
        >
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

          <div className="mt-1 flex items-center gap-3">
            <span className="h-px flex-1 bg-rule" aria-hidden />
            <span className="font-mono text-[0.7rem] text-graphite">or</span>
            <span className="h-px flex-1 bg-rule" aria-hidden />
          </div>

          <GuestLandingButton />

          <p className="font-mono mt-1 border-t border-rule pt-4 text-[0.72rem] leading-relaxed text-graphite">
            Connections are read-only. Export or delete your training data from
            Settings at any time.
          </p>
        </form>
      </div>
    </main>
  );
}
