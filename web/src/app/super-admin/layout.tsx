"use client";

import { usePathname } from "next/navigation";
import PortalShell from "@/components/layout/PortalShell";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === "/super-admin" || pathname?.startsWith("/super-admin/database")) {
    return <>{children}</>;
  }

  return (
    <PortalShell
      backHref="/admin"
      contentContainerClassName="w-full max-w-none"
      mainClassName="relative z-10 flex-1 overflow-x-hidden overflow-y-auto py-6 pr-6 pl-3 md:pl-4 xl:pl-2 print:bg-white print:p-0 print:overflow-visible"
    >
      {children}
    </PortalShell>
  );
}
