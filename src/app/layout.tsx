import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { TRPCReactProvider } from "@/lib/trpc/react";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

// Two families, split by role — the product's Engine⟷Methodology, human⟷machine split.
// Fraunces is the human voice (titles, prose, honest declarations); IBM Plex Mono is the
// machine readout (data, grades, labels, controls-as-commands).
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-fraunces",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Mainline: the honest chess training program",
  description:
    "Mainline is a personalized, science-based, no-BS chess training program. Every recommendation is graded and explained; it never promises you a rating.",
  applicationName: "Mainline",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mainline",
  },
  icons: { apple: "/icons/mainline-192.png" },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-paper text-ink min-h-screen antialiased">
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
