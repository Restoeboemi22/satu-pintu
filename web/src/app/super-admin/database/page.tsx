"use client";

import { usePathname } from "next/navigation";
import MasterDataWorkspace from "@/components/database/MasterDataWorkspace";
import PortalGateState from "@/components/ui/PortalGateState";
import { usePortalGuard } from "@/hooks/usePortalGuard";

export default function SuperAdminDatabasePage() {
  const pathname = usePathname();
  const returnTo = pathname || "/super-admin/database";
  const { status, isAllowed } = usePortalGuard({
    allowedRoles: ["super_admin"],
    returnTo,
    unauthenticatedRedirectTo: `/admin/login?returnTo=${encodeURIComponent(returnTo)}`,
    unauthorizedRedirectTo: "/admin",
  });

  if (status === "pending") {
    return <PortalGateState title="Memuat Database Super Admin..." description="Memverifikasi sesi portal super admin." />;
  }
  if (!isAllowed) {
    return null;
  }

  return <MasterDataWorkspace />;
}
