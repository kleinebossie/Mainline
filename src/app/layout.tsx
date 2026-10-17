import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import "./globals.css";
import { TRPCReactProvider } from "@/lib/trpc/react";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { ThemeProvider } from "@/components/theme-provider";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Direction A typography:
// Fraunces is the display voice (titles and major headings).
// Public Sans is the primary interface voice (body, navigation, buttons, controls).
// IBM Plex Mono is the machine voice (notation, tabular numbers, badges, timers).
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-fraunces",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-public-sans",
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
  icons: { icon: "/favicon.ico", apple: "/icons/mainline-192.png" },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${publicSans.variable} ${plexMono.variable} scroll-smooth`}
      suppressHydrationWarning
    >
      <body className="bg-paper text-ink min-h-screen font-sans antialiased">
        <ThemeProvider>
          <TRPCReactProvider>{children}</TRPCReactProvider>
          <ServiceWorkerRegistration />
          {(process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_ENV) && (
            <>
              <Analytics />
              <SpeedInsights />
            </>
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
