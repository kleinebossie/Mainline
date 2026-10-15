import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

// Fonts are self-hosted (no third-party font request at runtime — VISION §7: no ads, no
// tracking scripts) and split by role, per planning/DESIGN.md:
//   Archivo  — UI + display lettering (variable width: headings are set expanded)
//   Newsreader — prose only: rationale, caveats, landing copy
//   IBM Plex Mono — data only: move numbers, minutes, ratings, grade glyphs
import "@fontsource-variable/archivo/standard.css";
import "@fontsource-variable/newsreader/standard.css";
import "@fontsource-variable/newsreader/standard-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";
import { TRPCReactProvider } from "@/lib/trpc/react";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
  icons: { icon: "/favicon.ico", apple: "/icons/mainline-192.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f2f0" },
    { media: "(prefers-color-scheme: dark)", color: "#171a19" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-sheet text-ink min-h-screen antialiased">
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <ServiceWorkerRegistration />
        {(process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_ENV) && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
      </body>
    </html>
  );
}
