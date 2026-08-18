"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { trackFunnelEvent } from "@/lib/telemetry";
import { getGuestSession } from "@/lib/guest-session";

export function LandingTelemetry() {
  const router = useRouter();

  useEffect(() => {
    trackFunnelEvent("landing_view", {
      referrer: typeof document !== "undefined" ? document.referrer : undefined,
    });

    if (typeof window !== "undefined") {
      const revealSeen = localStorage.getItem("mainline_reveal_seen") === "true";
      const session = getGuestSession();
      if (revealSeen || session.program != null) {
        router.replace("/today");
      }
    }
  }, [router]);

  return null;
}

