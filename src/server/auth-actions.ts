"use server";

import { signOut } from "@/server/auth";

// A server action wrapper so client surfaces (the global AccountMenu) can sign out via a
// plain <form action={…}> without pulling auth internals into the client bundle.
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
