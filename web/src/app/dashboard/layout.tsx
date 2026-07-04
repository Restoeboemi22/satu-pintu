"use client";

import Sidebar from "@/components/layout/Sidebar";
import PortalGateState from "@/components/ui/PortalGateState";
import { usePortalGuard } from "@/hooks/usePortalGuard";
import { buildPortalLoginHref, DASHBOARD_ROLES, getPortalRoleLabel } from "@/lib/portalAccess";
import { useAuthStore } from "@/store/useAuthStore";
import { useDisciplineStore } from "@/store/useDisciplineStore";
import { useStudentStore } from "@/store/useStudentStore";
import { useAttendanceStore } from "@/store/useAttendanceStore";
import { useClassStore } from "@/store/useClassStore";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Search } from "lucide-react";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const returnTo = pathname || "/dashboard";
  const { user, status, isAllowed } = usePortalGuard({
    allowedRoles: DASHBOARD_ROLES,
    returnTo,
  });
  const { setActiveApp } = useAuthStore();
  const { setSchoolContext } = useAttendanceStore();
  const { initDisciplineSync } = useDisciplineStore();
  const { syncStudents } = useStudentStore();
  const { subscribeToClasses } = useClassStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const showHeaderUtilities = user?.role !== "admin";

  // Init Data Sync
  useEffect(() => {
    if (!isAllowed || !user) return;

    setActiveApp("gaspa");

    const schoolId = String(user?.schoolId || "").trim();
    const role = String(user?.role || "").trim();
    const shouldSyncSchoolScopedData = role !== "super_admin" && Boolean(schoolId);

    if (!shouldSyncSchoolScopedData) {
      setSchoolContext("");
      return;
    }

    setSchoolContext(schoolId);
    const unsubDiscipline = initDisciplineSync(schoolId);
    const unsubStudents = syncStudents();
    const unsubClasses = subscribeToClasses(schoolId);

    return () => {
      try {
        unsubDiscipline();
      } catch {}
      try {
        unsubStudents();
      } catch {}
      try {
        unsubClasses();
      } catch {}
    };
  }, [
    initDisciplineSync,
    isAllowed,
    setActiveApp,
    setSchoolContext,
    subscribeToClasses,
    syncStudents,
    user,
    user?.role,
    user?.schoolId,
  ]);

  if (status === "pending") {
    return <PortalGateState title="Memuat dashboard..." description="Menyiapkan sesi Portal dan konteks sekolah." />;
  }

  if (!isAllowed) {
    const isUnauthorized = status === "unauthorized";
    return (
      <PortalGateState
        title={isUnauthorized ? "Akses dashboard ditolak." : "Mengarahkan ke login Portal..."}
        description={
          isUnauthorized
            ? `Role ${getPortalRoleLabel(user?.role)} tidak memiliki akses ke shell dashboard ini.`
            : "Silakan login terlebih dahulu untuk membuka dashboard."
        }
        actionHref={buildPortalLoginHref(returnTo)}
        actionLabel="Ke Login Admin"
      />
    );
  }

  return (
    <div 
      className="flex h-screen"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)'
      }}
    >
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/80 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Desktop Sidebar */}
      <Sidebar className="hidden md:flex" />

      <div className="flex flex-1 flex-col overflow-hidden relative">
        {/* Premium Background Elements */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
          <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-blue-500 opacity-10 blur-[100px]"></div>
          <div className="absolute right-0 bottom-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-purple-500 opacity-10 blur-[100px]"></div>
        </div>

        <header className="relative z-10 flex h-20 items-center justify-between bg-slate-900/60 backdrop-blur-2xl border-b border-slate-700/50 px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl p-2.5 text-slate-400 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 md:hidden transition-colors"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="hidden sm:flex items-center gap-3 bg-slate-800/70 rounded-xl px-4 py-2.5 flex-1 max-w-md border border-slate-700/50">
              <Search className="h-5 w-5 text-slate-500" />
              <input 
                type="text" 
                placeholder="Cari sesuatu..." 
                className="bg-transparent border-none outline-none text-sm text-slate-200 w-full"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="hidden sm:inline-flex items-center justify-center rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900/60 hover:text-white"
            >
              Kembali ke Dashboard Satu Pintu
            </Link>
            {showHeaderUtilities ? (
              <>
                <div className="flex items-center gap-3 pl-4 border-l border-slate-700">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-slate-200">{user?.name}</p>
                    <p className="text-xs text-slate-500 capitalize">
                      {user?.role === "super_admin"
                        ? "Super Admin"
                        : user?.role === "admin"
                          ? "Admin Sekolah"
                          : user?.role === "teacher"
                            ? "Guru"
                            : "Siswa"}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl premium-gradient flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/30">
                    {user?.name?.charAt(0)}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </header>
        <main className="relative z-10 flex-1 overflow-x-hidden overflow-y-auto p-6 print:p-0 print:bg-white print:overflow-visible">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
