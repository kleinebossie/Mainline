import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { TRPCReactProvider } from "@/lib/trpc/react";

export const metadata: Metadata = {
  title: "Mainline",
  description:
    "Mainline — a personalized, science-based, no-BS chess training program that adapts as you play.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
