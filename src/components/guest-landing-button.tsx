"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { getGuestSession } from "@/lib/guest-session";

export function GuestLandingButton() {
  const router = useRouter();
  const [destination, setDestination] = useState("/onboarding/constraints");
  const [label, setLabel] = useState("Continue as guest →");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const revealSeen = localStorage.getItem("mainline_reveal_seen") === "true";
    const session = getGuestSession();

    if (revealSeen || session.program != null) {
      router.replace("/today");
      return;
    }

    if (
      session.baseline?.calibratedAt ||
      (session.calibrationResponses && session.calibrationResponses.length >= 3)
    ) {
      setDestination("/onboarding/reveal");
      setLabel("Resume setup (Step 4: Reveal) →");
    } else if (session.connections && session.connections.length > 0) {
      setDestination("/onboarding/calibration");
      setLabel("Resume setup (Step 3: Calibration) →");
    } else if (session.constraints != null) {
      setDestination("/connections");
      setLabel("Resume setup (Step 2: Connect) →");
    } else {
      setDestination("/onboarding/constraints");
      setLabel("Continue as guest →");
    }
  }, [router]);

  return (
    <Link
      href={destination}
      className={buttonVariants({
        variant: "ghost",
        size: "lg",
        className:
          "w-full border border-line text-ink hover:bg-paper-raised font-serif",
      })}
    >
      {label}
    </Link>
  );
}
