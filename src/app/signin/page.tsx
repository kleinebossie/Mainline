import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { buttonVariants } from "@/components/ui/button";
import { ErrorNotice } from "@/components/ui/error-notice";
import { Wordmark } from "@/components/app-shell";
import { beginSelectedBetaSignIn } from "@/app/signin/actions";
import { prisma } from "@/db/client";
import { getPostAuthDestination } from "@/server/onboarding";

// Custom sign-in page (Auth.js `pages.signIn`). Lichess needs no secret, so it is
// always offered; Google appears only when configured.
function signInErrorCopy(code: string | undefined) {
  if (code === "AccessDenied") {
    return {
      heading: "Beta access not granted",
      message:
        "This account is not on the beta list, or the invite code was not accepted. Check the code and try again with the same account.",
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
            Mainline is in closed beta. Sign in with an allowlisted email or
            enter the invite code you received. No password is ever stored.
          </p>
        </div>

        {signInError && (
          <ErrorNotice
            className="mb-4"
            heading={signInError.heading}
            message={signInError.message}
          />
        )}

        <div className="bg-card rounded-lg border p-6 shadow-sheet">
          <form action={beginSelectedBetaSignIn}>
            <label
              htmlFor="signin-invite"
              className="text-graphite mb-2 block text-xs"
            >
              Invite code (optional for allowlisted email)
            </label>
            <input
              id="signin-invite"
              name="inviteCode"
              autoComplete="one-time-code"
              maxLength={128}
              aria-describedby="signin-invite-help"
              className="border-input bg-paper-raised mb-3 w-full rounded-md border px-3 py-2 font-mono text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-paper"
            />
            <p
              id="signin-invite-help"
              className="text-graphite mb-4 font-mono text-[0.65rem] leading-relaxed"
            >
              Mainline never receives your provider password.
            </p>
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

          <p className="text-graphite mt-5 border-t border-line/80 pt-4 text-center font-mono text-[0.7rem] leading-relaxed">
            Connected game access is read-only. Your training data is exportable
            and deletable at any time.
          </p>
        </div>
      </div>
    </main>
  );
}
