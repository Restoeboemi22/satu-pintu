"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import PortalGateState from "@/components/ui/PortalGateState";
import { usePortalGuard } from "@/hooks/usePortalGuard";

export default function SuperAdminOneDoorPage() {
  const router = useRouter();
  const pathname = usePathname();
  const returnTo = pathname || "/super-admin";
  const { status, isAllowed } = usePortalGuard({
    allowedRoles: ["super_admin"],
    returnTo,
    unauthenticatedRedirectTo: `/admin/login?returnTo=${encodeURIComponent(returnTo)}`,
    unauthorizedRedirectTo: "/admin",
  });

  useEffect(() => {
    if (!isAllowed) return;
    router.replace("/admin");
  }, [isAllowed, router]);

  if (status === "pending") {
    return <PortalGateState title="Memuat Super Admin..." description="Memverifikasi sesi portal super admin." />;
  }
  if (!isAllowed) return null;

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(99,102,241,0.28),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(34,211,238,0.18),transparent_50%),radial-gradient(800px_circle_at_50%_85%,rgba(168,85,247,0.14),transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-black" />
      </div>
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center p-6">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-6 py-4 text-sm font-semibold text-slate-200 shadow-xl backdrop-blur">
          Mengalihkan ke Dashboard Satu Pintu...
        </div>
      </div>
    </div>
  );
}
