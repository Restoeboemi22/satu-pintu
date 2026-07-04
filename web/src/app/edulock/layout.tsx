"use client";

import PortalGateState from "@/components/ui/PortalGateState";
import { buildPortalLoginHref, getPortalRoleLabel } from "@/lib/portalAccess";
import { useAuthStore } from "@/store/useAuthStore";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEduLockAuth } from "@/lib/useEduLockAuth";
import { Suspense, useEffect, useMemo, useState } from "react";

function EduLockLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, _hasHydrated, setActiveApp } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user: edulockUser, profile: edulockProfile, role: edulockRole, isLoading: edulockLoading, error: edulockError, logout: edulockLogout } =
    useEduLockAuth();
  const [isMounted, setIsMounted] = useState(false);
  const isEduLockHomeRoute = pathname === "/edulock";
  const isEduLockLoginRoute = pathname === "/edulock/login";
  const isEduLockSuperRoute = Boolean(pathname && pathname.startsWith("/edulock/super"));
  const requestedReturnTo = useMemo(() => {
    const raw = String(searchParams?.get("returnTo") || "").trim();
    return raw.startsWith("/edulock") ? raw : "/edulock";
  }, [searchParams]);
  const currentRoute = useMemo(() => {
    const currentPath = pathname || "/edulock";
    const query = searchParams?.toString() || "";
    return query ? `${currentPath}?${query}` : currentPath;
  }, [pathname, searchParams]);
  const returnTo = isEduLockLoginRoute ? requestedReturnTo : currentRoute;
  const portalLoginHref = buildPortalLoginHref(returnTo);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !_hasHydrated) return;
    if (!isAuthenticated) {
      router.replace(portalLoginHref);
      return;
    }
    if (isEduLockSuperRoute) {
      if (user?.role !== "super_admin") {
        router.replace("/admin");
        return;
      }
      if (edulockLoading) return;
      if (!edulockUser) {
        router.replace(`/edulock/login?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      if (!edulockProfile) return;
      if (edulockRole !== "super_admin") {
        router.replace("/edulock");
        return;
      }
      setActiveApp("edulock");
      return;
    }
    if (user?.role !== "admin" && user?.role !== "super_admin") {
      router.replace("/dashboard");
      return;
    }
    setActiveApp("edulock");
  }, [isMounted, _hasHydrated, isAuthenticated, router, setActiveApp, user?.role, isEduLockSuperRoute, returnTo, portalLoginHref, edulockLoading, edulockRole, edulockUser]);

  useEffect(() => {
    if (!isMounted || !_hasHydrated) return;
    if (!isAuthenticated || (user?.role !== "admin" && user?.role !== "super_admin")) return;

    if (isEduLockSuperRoute || isEduLockHomeRoute) return;
    if (!edulockUser && !isEduLockLoginRoute) {
      router.replace(`/edulock/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (edulockUser && isEduLockLoginRoute) {
      router.replace(requestedReturnTo);
      return;
    }
  }, [edulockUser, isAuthenticated, isMounted, pathname, requestedReturnTo, router, user?.role, _hasHydrated, isEduLockHomeRoute, isEduLockLoginRoute, isEduLockSuperRoute, returnTo]);

  if (!isMounted || !_hasHydrated) return <PortalGateState title="Memuat EduLock..." description="Menyiapkan sesi Portal." />;
  if (!isAuthenticated) return <PortalGateState title="Belum login." description="Silakan login admin terlebih dahulu." actionHref={portalLoginHref} actionLabel="Ke Login Admin" />;
  if (isEduLockSuperRoute) {
    if (user?.role !== "super_admin") return <PortalGateState title="Akses ditolak." description={`Role ${getPortalRoleLabel(user?.role)} tidak dapat membuka EduLock Super Admin.`} actionHref={portalLoginHref} actionLabel="Ke Login Admin" />;
    if (edulockLoading) return <PortalGateState title="Memuat EduLock..." description="Memverifikasi sesi EduLock Super Admin." />;
    if (!edulockUser) return <PortalGateState title="Perlu login EduLock." description="Silakan login EduLock terlebih dahulu untuk mengakses Super Admin." actionHref={`/edulock/login?returnTo=${encodeURIComponent(returnTo)}`} actionLabel="Ke Login EduLock" />;
    if (!edulockProfile) return <PortalGateState title="Memuat EduLock..." description="Menyelaraskan profil EduLock Super Admin." />;
    if (edulockRole !== "super_admin") return <PortalGateState title="Akses ditolak." description="Sesi EduLock aktif Anda bukan super admin." actionHref={portalLoginHref} actionLabel="Ke Login Admin" />;
  } else {
    if (user?.role !== "admin" && user?.role !== "super_admin") return <PortalGateState title="Akses ditolak." description={`Role ${getPortalRoleLabel(user?.role)} tidak memiliki akses ke EduLock.`} actionHref={portalLoginHref} actionLabel="Ke Login Admin" />;
  }

  if (!isEduLockLoginRoute && !isEduLockSuperRoute && !isEduLockHomeRoute) {
    if (edulockLoading) return <PortalGateState title="Memuat EduLock..." description="Menyiapkan sesi EduLock." />;
    if (!edulockUser) return <PortalGateState title="Perlu login EduLock." description="Silakan login terlebih dahulu untuk mengakses EduLock Admin Sekolah." actionHref="/edulock/login" actionLabel="Ke Login EduLock" />;
  }

  return (
    <>
      {!isEduLockLoginRoute && !isEduLockSuperRoute && edulockError ? (
        <div className="p-6">
          <div className="rounded-lg bg-white p-6 shadow-sm border border-red-200">
            <div className="text-sm font-semibold text-red-700">EduLock Error</div>
            <div className="mt-1 text-sm text-gray-700">{edulockError}</div>
            <div className="mt-4">
              <button
                type="button"
                onClick={async () => {
                  await edulockLogout();
                  router.push("/edulock/login");
                }}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Keluar & Login Ulang
              </button>
            </div>
          </div>
        </div>
      ) : (
        children
      )}
    </>
  );
}

export default function EduLockLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<PortalGateState title="Memuat EduLock..." description="Menyiapkan sesi Portal." />}>
      <EduLockLayoutInner>{children}</EduLockLayoutInner>
    </Suspense>
  );
}
