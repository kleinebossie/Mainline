"use server";

import { signIn } from "@/server/auth";
import { POST_AUTH_ENTRY_PATH } from "@/server/onboarding";

export async function beginSelectedBetaSignIn(
  formData: FormData,
): Promise<void> {
  const provider = String(formData.get("provider") ?? "");
  if (provider !== "lichess" && provider !== "google") {
    throw new Error("Choose a sign-in provider.");
  }
  await signIn(provider, { redirectTo: POST_AUTH_ENTRY_PATH });
}
