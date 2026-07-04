"use client";

import { usePathname } from "next/navigation";
import PortalGateState from "@/components/ui/PortalGateState";
import { usePortalGuard } from "@/hooks/usePortalGuard";

export default function GaspaSuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const returnTo = pathname || "/dashboard/super";
  const { status, isAllowed } = usePortalGuard({
    allowedRoles: ["super_admin"],
    returnTo,
    unauthenticatedRedirectTo: `/admin/login?returnTo=${encodeURIComponent(returnTo)}`,
    unauthorizedRedirectTo: "/admin",
  });

  if (status === "pending") {
    return <PortalGateState title="Memuat Super Admin..." description="Memverifikasi sesi portal super admin." />;
  }
  if (!isAllowed) {
    return null;
  }

  return children;
}
