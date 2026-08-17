"use client";

import { useEffect } from "react";
import { trackFunnelEvent } from "@/lib/telemetry";

export function LandingTelemetry() {
  useEffect(() => {
    trackFunnelEvent("landing_view", {
      referrer: typeof document !== "undefined" ? document.referrer : undefined,
    });
  }, []);

  return null;
}
