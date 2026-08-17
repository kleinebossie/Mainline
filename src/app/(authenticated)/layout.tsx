import type { ReactNode } from "react";
import { GuestMigrationSync } from "@/components/guest-migration-sync";

export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <GuestMigrationSync />
      {children}
    </>
  );
}
