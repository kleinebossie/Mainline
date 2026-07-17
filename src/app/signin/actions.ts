"use server";

import { cookies } from "next/headers";

import { BETA_INVITE_COOKIE } from "@/server/beta-access";
import { signIn } from "@/server/auth";
import { POST_AUTH_ENTRY_PATH } from "@/server/onboarding";

async function beginBetaSignIn(
  provider: "lichess" | "google",
  formData: FormData,
): Promise<void> {
  const inviteCode = String(formData.get("inviteCode") ?? "").trim();
  const cookieStore = await cookies();
  if (inviteCode) {
    cookieStore.set(BETA_INVITE_COOKIE, inviteCode.slice(0, 128), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 15 * 60,
    });
  } else {
    cookieStore.delete(BETA_INVITE_COOKIE);
  }
  // The root resolves the signed-in user's canonical destination from persisted
  // onboarding state, so OAuth completion cannot drift from normal app entry.
  await signIn(provider, { redirectTo: POST_AUTH_ENTRY_PATH });
}

export async function beginSelectedBetaSignIn(
  formData: FormData,
): Promise<void> {
  const provider = String(formData.get("provider") ?? "");
  if (provider !== "lichess" && provider !== "google") {
    throw new Error("Choose a sign-in provider.");
  }
  await beginBetaSignIn(provider, formData);
}
