"use server";

import { cookies } from "next/headers";

import { BETA_INVITE_COOKIE } from "@/server/beta-access";
import { signIn } from "@/server/auth";

export async function beginBetaSignIn(
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
  await signIn(provider, { redirectTo: "/connections" });
}
