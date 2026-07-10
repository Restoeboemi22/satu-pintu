"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuthStore } from "@/store/useAuthStore";
import { usePathname, useSearchParams } from "next/navigation";
import { LenteraLogoutButton } from "@/components/lentera/LenteraLogoutButton";
import { useEffect, useMemo } from "react";
import {
  LayoutDashboard, Users, UserCheck,
  BookOpen, Award, Settings, Bell, AlertTriangle,
  Clock, ChevronRight, ChevronDown, School, Database, Lock, Activity, FileText, BarChart3,
  Command, LifeBuoy, MapPinned, Network, Shield, ShieldCheck, Workflow
} from "lucide-react";

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

const Sidebar = ({ className = "", onClose }: SidebarProps) => {
  const { user, activeApp, setActiveApp } = useAuthStore();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  const inferredApp = pathname?.startsWith("/edulock") ? "edulock" : "gaspa";
  const isGaspaAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isGaspaSuperMode = user?.role === "super_admin" && Boolean(pathname?.startsWith("/dashboard/super"));
  const isGasModuleRoute = Boolean(pathname?.startsWith("/dashboard"));
  const isEduLockModuleRoute = Boolean(pathname?.startsWith("/edulock"));
  const isLenteraModuleRoute = Boolean(pathname?.startsWith("/admin/lentera"));
  const isAdminGasWorkspaceRoute = user?.role === "admin" && isGasModuleRoute;
  const isAdminEduLockWorkspaceRoute = user?.role === "admin" && isEduLockModuleRoute;
  const isAdminLenteraWorkspaceRoute = user?.role === "admin" && isLenteraModuleRoute;
  const isServiceStatusRoute = user?.role === "super_admin" && Boolean(pathname?.startsWith("/dashboard/super/service-status"));
  const isGasBrandRoute = isGasModuleRoute && !isServiceStatusRoute;
  const isEduLockBrandRoute = isEduLockModuleRoute;
  const isLenteraBrandRoute = isAdminLenteraWorkspaceRoute;
  const showDatabaseSection = !isEduLockModuleRoute && !isAdminGasWorkspaceRoute && !isAdminEduLockWorkspaceRoute && !isAdminLenteraWorkspaceRoute;
  const showGasSection = !isEduLockModuleRoute && !isAdminLenteraWorkspaceRoute;
  const showEduLockSection = !isGasModuleRoute && !isAdminLenteraWorkspaceRoute;
  const showLenteraSection = !isEduLockModuleRoute && !isAdminGasWorkspaceRoute && !isAdminEduLockWorkspaceRoute;
  const lenteraTab = String(searchParams.get("tab") || "").trim();
  const lenteraView = String(searchParams.get("view") || "").trim();
  const lenteraTaskViewRaw = String(searchParams.get("taskView") || "").trim();
  const lenteraTaskView = lenteraTaskViewRaw === "needs-grading" || lenteraTaskViewRaw === "history" ? lenteraTaskViewRaw : "tasks";
  const isPresensiGroupActive = Boolean(
    pathname === "/dashboard/attendance" ||
      pathname?.startsWith("/dashboard/attendance/") ||
      pathname === "/dashboard/presensi-sholat" ||
      pathname?.startsWith("/dashboard/presensi-sholat/")
  );
  const isPresensiGroupExpanded = useMemo(() => isPresensiGroupActive, [isPresensiGroupActive]);
  const lenteraActiveKey = useMemo(() => {
    const safePathname = String(pathname || "");
    if (safePathname.startsWith("/admin/lentera/anggota")) return "members";
    if (safePathname.startsWith("/admin/lentera/pengaturan")) return "settings";
    if (lenteraTab === "tasks") return "tasks";
    if (lenteraTab === "literacy" && (lenteraView === "progress" || lenteraView === "list")) return "stats";
    if (lenteraTab === "loans") return "loans";
    if (safePathname.startsWith("/admin/lentera")) return "dashboard";
    return "";
  }, [lenteraTab, lenteraView, pathname]);
  const showLenteraTaskSubmenu = isAdminLenteraWorkspaceRoute && lenteraTab === "tasks";

  useEffect(() => {
    if (!isGaspaAdmin) return;
    if (activeApp !== inferredApp) setActiveApp(inferredApp);
  }, [activeApp, inferredApp, isGaspaAdmin, setActiveApp]);

  if (!user) return null;

  const serviceStatusMenuIcon = (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-cyan-400/20 bg-cyan-500/10 shadow-sm shadow-cyan-500/10">
      <Image src="/status-layanan-sekolah.png" alt="Status Layanan Sekolah" width={24} height={24} className="h-5 w-5 object-contain" />
    </span>
  );

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (pathname === href) return true;
    if (href === "/dashboard/super") return false;
    if (href !== "/" && pathname.startsWith(`${href}/`)) return true;
    return false;
  };

  const isActiveWithQuery = (href: string, key: string, value: string) => {
    if (!pathname) return false;
    if (pathname !== href) return false;
    if (typeof window === "undefined") return false;
    return String(new URLSearchParams(window.location.search).get(key) || "").trim() === value;
  };

  const linkClassByState = (active: boolean, variant: "normal" | "section" = "normal") => {
    const base =
      variant === "section"
        ? "flex items-center gap-3 px-4 py-3 mb-1 text-sm font-medium transition-all duration-200 rounded-xl"
        : "flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-200 rounded-xl";

    return `${base} ${
      active
        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30"
        : "text-slate-300 hover:bg-white/10 hover:text-white"
    }`;
  };

  const linkClass = (href: string, variant: "normal" | "section" = "normal") => {
    return linkClassByState(isActive(href), variant);
  };

  return (
    <div className={`flex h-full w-72 flex-col bg-premium text-white print:hidden border-r border-white/10 ${className}`}>
      <div className="border-b border-white/10 px-5 pb-4 pt-5">
        <div className={`rounded-2xl border border-white/10 bg-white/5 ${isGasBrandRoute || isEduLockBrandRoute ? "p-5" : "p-4"}`}>
          {isGasBrandRoute ? (
            <div className="flex flex-col items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-cyan-500/15 shadow-lg shadow-cyan-500/15">
                <Image
                  src="/Icon_GAS.png"
                  alt="GAS"
                  width={72}
                  height={72}
                  className="h-[72px] w-[72px] object-contain"
                />
              </div>
              <div className="mt-3 text-base font-bold leading-tight text-white">Gerbang Aplikasi Sekolah</div>
              <div className="mt-1 text-xs text-slate-400">
                {user?.role === "super_admin" ? "Super Admin" : "Admin Sekolah"}
              </div>
            </div>
          ) : isEduLockBrandRoute ? (
            <div className="flex flex-col items-center text-center">
              <Image
                src="/Logo EduLock.png"
                alt="EduLock"
                width={220}
                height={98}
                className="h-auto w-full max-w-[200px] object-contain"
                priority
              />
              <div className="mt-3 text-base font-bold leading-tight text-white">EduLock</div>
              <div className="mt-1 text-xs text-slate-400">
                {user?.role === "super_admin" ? "Super Admin" : "Admin Sekolah"}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-cyan-200/80">
                Control Panel
              </div>
            </div>
          ) : isLenteraBrandRoute ? (
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 ring-1 ring-blue-400/30">
                <BookOpen className="h-6 w-6 text-blue-200" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-bold text-white">Lentera</div>
                <div className="text-xs text-slate-400">Admin Panel</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {isServiceStatusRoute ? (
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-cyan-400/20 bg-cyan-500/10 shadow-lg shadow-cyan-500/10">
                  <Image src="/status-layanan-sekolah.png" alt="Status Layanan Sekolah" width={48} height={48} className="h-10 w-10 object-contain" />
                </div>
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 shadow-lg">
                  <Image
                    src="/PortalKita.png"
                    alt="Dashboard Satu Pintu"
                    width={40}
                    height={40}
                    className="object-contain"
                  />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">
                  {isServiceStatusRoute ? "Status Layanan Sekolah" : "Dashboard Satu Pintu"}
                </div>
                <div className="text-xs text-slate-400">
                  {isServiceStatusRoute
                    ? "Super Admin"
                    : user?.role === "super_admin"
                      ? "Super Admin"
                      : "Admin Sekolah"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="px-6 py-4 bg-white/5">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Logged in as:</p>
        <p className="font-semibold truncate text-white">{user.name}</p>
        <p className="text-xs text-blue-400 uppercase font-semibold mt-1">{user.role}</p>
        {user.schoolName && (
          <p className="text-xs text-slate-400 mt-1 truncate">{user.schoolName}</p>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {isServiceStatusRoute ? (
          <>
            <div className="px-4 py-2 text-xs font-semibold tracking-widest text-slate-400">SUPER ADMIN</div>
            <Link
              href="/dashboard/super/service-status"
              className={linkClass("/dashboard/super/service-status", "section")}
              onClick={handleLinkClick}
            >
              {serviceStatusMenuIcon}
              <span>Status Layanan Sekolah</span>
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            </Link>
          </>
        ) : (
          <>
        {/* ADMIN MENU (Full Access) */}
        {isGaspaAdmin && (
          <>
            {showDatabaseSection && (
              <>
                <div className="px-4 py-2 text-xs font-semibold tracking-widest text-slate-400">DATABASE</div>
                {user.role === "super_admin" ? (
                  <>
                    <Link href="/super-admin/database" className={linkClass("/super-admin/database", "section")} onClick={handleLinkClick}>
                      <Database className="w-5 h-5" />
                      <span>Database Induk</span>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/admin/students?sub=students" className={linkClass("/admin/students", "section")} onClick={handleLinkClick}>
                      <Database className="w-5 h-5" />
                      <span>Database Sekolah</span>
                    </Link>
                    <Link href="/admin/students?sub=students" className={`${linkClass("/admin/students")} ml-4`} onClick={handleLinkClick}>
                      <Users className="w-4 h-4" />
                      <span>Siswa</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link href="/admin/students?sub=teachers" className={`${linkClass("/admin/students")} ml-4`} onClick={handleLinkClick}>
                      <UserCheck className="w-4 h-4" />
                      <span>Guru/Wali Kelas</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link href="/admin/students?sub=staff" className={`${linkClass("/admin/students")} ml-4`} onClick={handleLinkClick}>
                      <UserCheck className="w-4 h-4" />
                      <span>Petugas OSIS</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link href="/admin/students?sub=classes" className={`${linkClass("/admin/students")} ml-4`} onClick={handleLinkClick}>
                      <School className="w-4 h-4" />
                      <span>Kelas Paralel</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                  </>
                )}
              </>
            )}

            {showGasSection && (
              <>
                <div className="h-px bg-white/10 my-3 mx-2"></div>
                <div className="px-4 py-2 text-xs font-semibold tracking-widest text-slate-400">GAS</div>
                {user.role === "super_admin" ? (
                  <>
                    <Link
                      href="/dashboard/super"
                      className={linkClassByState(pathname === "/dashboard/super", "section")}
                      onClick={handleLinkClick}
                    >
                      <LayoutDashboard className="w-5 h-5" />
                      <span>Super Admin GAS</span>
                    </Link>
                    <Link href="/dashboard/super/tenants" className={`${linkClass("/dashboard/super/tenants")} ml-4`} onClick={handleLinkClick}>
                      <School className="w-4 h-4" />
                      <span>Tenant & Sekolah</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link href="/dashboard/super/global-config" className={`${linkClass("/dashboard/super/global-config")} ml-4`} onClick={handleLinkClick}>
                      <Settings className="w-4 h-4" />
                      <span>Konfigurasi Global</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link href="/dashboard/super/broadcast" className={`${linkClass("/dashboard/super/broadcast")} ml-4`} onClick={handleLinkClick}>
                      <Bell className="w-4 h-4" />
                      <span>Broadcast</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link href="/dashboard/super/sync-jobs" className={`${linkClass("/dashboard/super/sync-jobs")} ml-4`} onClick={handleLinkClick}>
                      <Clock className="w-4 h-4" />
                      <span>Sync Jobs</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/dashboard/students" className={linkClass("/dashboard/students", "section")} onClick={handleLinkClick}>
                      <LayoutDashboard className="w-5 h-5" />
                      <span>Beranda GAS</span>
                    </Link>
                    {isAdminGasWorkspaceRoute && <div className="h-px bg-white/10 my-3 mx-2"></div>}
                    {isAdminGasWorkspaceRoute && (
                      <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Master Data</div>
                    )}
                    <Link href="/dashboard/students" className={linkClass("/dashboard/students")} onClick={handleLinkClick}>
                      <Users className="w-4 h-4" />
                      <span>Manajemen Siswa</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <div className="mb-1">
                      <Link
                        href="/dashboard/attendance"
                        onClick={handleLinkClick}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-200 rounded-xl ${
                          isPresensiGroupActive
                            ? "bg-gradient-to-r from-blue-600/20 to-cyan-500/10 text-white border border-blue-500/30"
                            : "text-slate-300 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                        <span>Manajemen Presensi</span>
                        {isPresensiGroupExpanded ? (
                          <ChevronDown className="w-4 h-4 ml-auto opacity-60" />
                        ) : (
                          <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                        )}
                      </Link>

                      {isPresensiGroupExpanded && (
                        <div className="mt-1 ml-6 space-y-1 border-l border-white/10 pl-3">
                          <Link href="/dashboard/attendance" className={linkClass("/dashboard/attendance")} onClick={handleLinkClick}>
                            <Clock className="w-4 h-4" />
                            <span>Presensi Sekolah</span>
                            <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                          </Link>

                          <Link href="/dashboard/presensi-sholat" className={linkClass("/dashboard/presensi-sholat")} onClick={handleLinkClick}>
                            <Clock className="w-4 h-4" />
                            <span>Presensi Sholat</span>
                            <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                          </Link>
                        </div>
                      )}
                    </div>
                    <Link href="/dashboard/settings" className={linkClass("/dashboard/settings")} onClick={handleLinkClick}>
                      <Settings className="w-4 h-4" />
                      <span>Pengaturan Sistem</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    {isAdminGasWorkspaceRoute && (
                      <>
                        <div className="h-px bg-white/10 my-3 mx-2"></div>
                        <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Monitoring & Laporan</div>
                        <Link href="/dashboard/attendance-report" className={linkClass("/dashboard/attendance-report")} onClick={handleLinkClick}>
                          <Clock className="w-4 h-4" />
                          <span>Rekap Kehadiran</span>
                          <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                        </Link>
                        <Link href="/dashboard/discipline" className={linkClass("/dashboard/discipline")} onClick={handleLinkClick}>
                          <Award className="w-4 h-4" />
                          <span>Rekap Kedisiplinan</span>
                          <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                        </Link>
                        <Link href="/dashboard/library" className={linkClass("/dashboard/library")} onClick={handleLinkClick}>
                          <BookOpen className="w-4 h-4" />
                          <span>Monitoring E-Library</span>
                          <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                        </Link>
                        <Link href="/dashboard/prayer-monitoring" className={linkClass("/dashboard/prayer-monitoring")} onClick={handleLinkClick}>
                          <Clock className="w-4 h-4" />
                          <span>Rekap Sholat</span>
                          <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                        </Link>
                        <Link href="/dashboard/virtual-pet" className={linkClass("/dashboard/virtual-pet")} onClick={handleLinkClick}>
                          <Users className="w-4 h-4" />
                          <span>Virtual Pet Monitor</span>
                          <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                        </Link>
                        <Link href="/dashboard/seven-habits" className={linkClass("/dashboard/seven-habits")} onClick={handleLinkClick}>
                          <Award className="w-4 h-4" />
                          <span>7 KAIH</span>
                          <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                        </Link>
                        <div className="h-px bg-white/10 my-3 mx-2"></div>
                        <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Layanan Aduan</div>
                        <Link href="/dashboard/halo-spentgapa" className={linkClass("/dashboard/halo-spentgapa")} onClick={handleLinkClick}>
                          <AlertTriangle className="w-4 h-4" />
                          <span>Laporan Masuk</span>
                          <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                        </Link>
                        <div className="h-px bg-white/10 my-3 mx-2"></div>
                        <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Notifikasi</div>
                        <Link href="/dashboard/notifications" className={linkClass("/dashboard/notifications")} onClick={handleLinkClick}>
                          <Bell className="w-4 h-4" />
                          <span>Broadcast Notifikasi</span>
                          <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                        </Link>
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {showEduLockSection && (
              <>
                <div className="h-px bg-white/10 my-3 mx-2"></div>
                <div className="px-4 py-2 text-xs font-semibold tracking-widest text-slate-400">EDULOCK</div>
                <Link href="/edulock" className={linkClass("/edulock", "section")} onClick={handleLinkClick}>
                  <Lock className="w-5 h-5" />
                  <span>EduLock</span>
                </Link>
                {user.role === "super_admin" ? (
                  <>
                    <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Overview</div>
                    <Link
                      href="/edulock/super?section=dashboard"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/super", "section", "dashboard"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span>Dashboard</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link
                      href="/edulock/super?section=monitoring"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/super", "section", "monitoring"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <Activity className="w-4 h-4" />
                      <span>Realtime Monitoring</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>

                    <div className="px-4 py-2 pt-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Operasional</div>
                    <Link
                      href="/edulock/super?section=tenants"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/super", "section", "tenants"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <Network className="w-4 h-4" />
                      <span>Tenant EduLock</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link
                      href="/edulock/super?section=admins"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/super", "section", "admins"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <Users className="w-4 h-4" />
                      <span>Admin Sekolah</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link
                      href="/edulock/super?section=command_center"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/super", "section", "command_center"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <Command className="w-4 h-4" />
                      <span>Command Center / Uninstall</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>

                    <div className="px-4 py-2 pt-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Keamanan</div>
                    <Link
                      href="/edulock/super?section=policy_center"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/super", "section", "policy_center"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <Shield className="w-4 h-4" />
                      <span>Policy Center</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link
                      href="/edulock/super?section=zone_templates"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/super", "section", "zone_templates"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <MapPinned className="w-4 h-4" />
                      <span>Zone Templates</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link
                      href="/edulock/super?section=device_fleet"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/super", "section", "device_fleet"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Device Fleet</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link
                      href="/edulock/super?section=izin_exception"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/super", "section", "izin_exception"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <Lock className="w-4 h-4" />
                      <span>Izin / Exception</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link
                      href="/edulock/super?section=audit"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/super", "section", "audit"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <Workflow className="w-4 h-4" />
                      <span>Audit</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>

                    <div className="px-4 py-2 pt-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Konfigurasi</div>
                    <Link
                      href="/edulock/super?section=integrations"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/super", "section", "integrations"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <Network className="w-4 h-4" />
                      <span>Integrations</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link
                      href="/edulock/super?section=support"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/super", "section", "support"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <LifeBuoy className="w-4 h-4" />
                      <span>Support</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link
                      href="/edulock/super?section=settings"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/super", "section", "settings"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/edulock/admin?tab=dashboard"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/admin", "tab", "dashboard"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <Activity className="w-4 h-4" />
                      <span>Dashboard EduLock</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link
                      href="/edulock/admin?tab=monitoring"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/admin", "tab", "monitoring"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <Clock className="w-4 h-4" />
                      <span>Realtime Monitoring</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link
                      href="/edulock/admin?tab=codes"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/admin", "tab", "codes"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <Lock className="w-4 h-4" />
                      <span>Kelola Kode Izin</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link
                      href="/edulock/admin?tab=geofencing"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/admin", "tab", "geofencing"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <School className="w-4 h-4" />
                      <span>Pengaturan Zona</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link
                      href="/edulock/admin?tab=students"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/admin", "tab", "students"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <Users className="w-4 h-4" />
                      <span>Data Siswa</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link
                      href="/edulock/admin?tab=classes"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/admin", "tab", "classes"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <School className="w-4 h-4" />
                      <span>Manajemen Kelas</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link
                      href="/edulock/admin?tab=violations"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/admin", "tab", "violations"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      <span>Audit Log Pelanggaran</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                    <Link
                      href="/edulock/admin?tab=settings"
                      className={`${linkClassByState(isActiveWithQuery("/edulock/admin", "tab", "settings"), "normal")} ml-4`}
                      onClick={handleLinkClick}
                    >
                      <Settings className="w-4 h-4" />
                      <span>Settings EduLock</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                  </>
                )}
              </>
            )}

            {showLenteraSection && (
              <>
                <div className="h-px bg-white/10 my-3 mx-2"></div>
                <div className="px-4 py-2 text-xs font-semibold tracking-widest text-slate-400">
                  {user.role === "super_admin" ? "STATUS LAYANAN SEKOLAH" : "LENTERA DIGITAL"}
                </div>
                {user.role === "super_admin" ? (
                  <>
                    <Link href="/dashboard/super/service-status" className={linkClass("/dashboard/super/service-status", "section")} onClick={handleLinkClick}>
                      {serviceStatusMenuIcon}
                      <span>Status Layanan Sekolah</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </Link>
                  </>
                ) : (
                  <>
                    {isAdminLenteraWorkspaceRoute ? (
                      <>
                        <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Menu Utama</div>
                        <Link
                          href="/admin/lentera"
                          className={linkClassByState(lenteraActiveKey === "dashboard", "section")}
                          onClick={handleLinkClick}
                        >
                          <LayoutDashboard className="w-5 h-5" />
                          <span>Dashboard</span>
                        </Link>
                        <Link
                          href="/admin/lentera?tab=loans"
                          className={linkClassByState(lenteraActiveKey === "loans")}
                          onClick={handleLinkClick}
                        >
                          <BookOpen className="w-4 h-4" />
                          <span>Peminjaman</span>
                        </Link>
                        <Link
                          href="/admin/lentera?tab=tasks"
                          className={linkClassByState(lenteraActiveKey === "tasks")}
                          onClick={handleLinkClick}
                        >
                          <FileText className="w-4 h-4" />
                          <span>Kelola Literasi</span>
                        </Link>
                        {showLenteraTaskSubmenu ? (
                          <div className="ml-7 mt-1 space-y-1 border-l border-white/10 pl-3">
                            <Link
                              href="/admin/lentera?tab=tasks&taskView=tasks"
                              className={linkClassByState(lenteraTab === "tasks" && lenteraTaskView === "tasks")}
                              onClick={handleLinkClick}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                              <span>Daftar Tugas</span>
                            </Link>
                            <Link
                              href="/admin/lentera?tab=tasks&taskView=needs-grading"
                              className={linkClassByState(lenteraTab === "tasks" && lenteraTaskView === "needs-grading")}
                              onClick={handleLinkClick}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                              <span>Perlu Dinilai</span>
                            </Link>
                            <Link
                              href="/admin/lentera?tab=tasks&taskView=history"
                              className={linkClassByState(lenteraTab === "tasks" && lenteraTaskView === "history")}
                              onClick={handleLinkClick}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                              <span>Riwayat</span>
                            </Link>
                          </div>
                        ) : null}
                        <Link
                          href="/admin/lentera/anggota"
                          className={linkClassByState(lenteraActiveKey === "members")}
                          onClick={handleLinkClick}
                        >
                          <Users className="w-4 h-4" />
                          <span>Data Anggota</span>
                        </Link>
                        <Link
                          href="/admin/lentera?tab=literacy&view=progress"
                          className={linkClassByState(lenteraActiveKey === "stats")}
                          onClick={handleLinkClick}
                        >
                          <BarChart3 className="w-4 h-4" />
                          <span>Statistik Siswa</span>
                        </Link>
                        <div className="h-px bg-white/10 my-4 mx-2"></div>
                        <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Lainnya</div>
                        <Link
                          href="/admin/lentera/pengaturan"
                          className={linkClassByState(lenteraActiveKey === "settings")}
                          onClick={handleLinkClick}
                        >
                          <Settings className="w-4 h-4" />
                          <span>Pengaturan</span>
                        </Link>
                        <div className="mt-1">
                          <LenteraLogoutButton />
                        </div>
                      </>
                    ) : (
                      <>
                        <Link href="/admin/lentera" className={linkClass("/admin/lentera", "section")} onClick={handleLinkClick}>
                          <BookOpen className="w-5 h-5" />
                          <span>Lentera Digital</span>
                        </Link>
                        <Link href="/admin/lentera/pengaturan" className={`${linkClass("/admin/lentera/pengaturan")} ml-4`} onClick={handleLinkClick}>
                          <Settings className="w-4 h-4" />
                          <span>Pengaturan Lentera</span>
                          <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                        </Link>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
          </>
        )}


        {/* TEACHER MENU (Matched with APK Structure) */}
        {user.role === 'teacher' && (
          <>
            <Link href="/dashboard/virtual-pet" className={linkClass("/dashboard/virtual-pet")} onClick={handleLinkClick}>
              <Users className="w-4 h-4" />
              <span>Data Siswa</span>
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            </Link>
            <Link href="/dashboard/attendance-report" className={linkClass("/dashboard/attendance-report")} onClick={handleLinkClick}>
              <Clock className="w-4 h-4" />
              <span>Presensi Siswa</span>
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            </Link>
            <Link href="/dashboard/discipline" className={linkClass("/dashboard/discipline")} onClick={handleLinkClick}>
              <Award className="w-4 h-4" />
              <span>Kedisiplinan</span>
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            </Link>
            <Link href="/dashboard/library" className={linkClass("/dashboard/library")} onClick={handleLinkClick}>
              <BookOpen className="w-4 h-4" />
              <span>Literasi & Tugas</span>
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            </Link>
            <Link href="/dashboard/halo-spentgapa" className={linkClass("/dashboard/halo-spentgapa")} onClick={handleLinkClick}>
              <AlertTriangle className="w-4 h-4" />
              <span>Layanan Aduan</span>
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            </Link>
            <Link href="/dashboard/notifications" className={linkClass("/dashboard/notifications")} onClick={handleLinkClick}>
              <Bell className="w-4 h-4" />
              <span>Notifikasi</span>
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            </Link>
          </>
        )}

        {/* STUDENT MENU (Matched with APK Structure) */}
        {user.role === 'student' && (
          <>
            <Link href="/dashboard" className={linkClass("/dashboard", "section")} onClick={handleLinkClick}>
              <LayoutDashboard className="w-5 h-5" />
              <span>Home</span>
            </Link>
            <div className="h-px bg-white/10 my-3 mx-2"></div>

            <Link href="/dashboard/library" className={linkClass("/dashboard/library")} onClick={handleLinkClick}>
              <BookOpen className="w-4 h-4" />
              <span>Lentera Digital</span>
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            </Link>
            <Link href="/dashboard/attendance-report" className={linkClass("/dashboard/attendance-report")} onClick={handleLinkClick}>
              <Clock className="w-4 h-4" />
              <span>Absensi</span>
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            </Link>
            <Link href="/dashboard/discipline" className={linkClass("/dashboard/discipline")} onClick={handleLinkClick}>
              <Award className="w-4 h-4" />
              <span>Kedisiplinan</span>
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            </Link>
            <Link href="/dashboard/virtual-pet" className={linkClass("/dashboard/virtual-pet")} onClick={handleLinkClick}>
              <Users className="w-4 h-4" />
              <span>Virtual Pet</span>
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            </Link>
            <Link href="/dashboard/seven-habits" className={linkClass("/dashboard/seven-habits")} onClick={handleLinkClick}>
              <Award className="w-4 h-4" />
              <span>7 KAIH</span>
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            </Link>
            <Link href="/dashboard/halo-spentgapa" className={linkClass("/dashboard/halo-spentgapa")} onClick={handleLinkClick}>
              <AlertTriangle className="w-4 h-4" />
              <span>Layanan Aduan</span>
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            </Link>
            <Link href="/dashboard/notifications" className={linkClass("/dashboard/notifications")} onClick={handleLinkClick}>
              <Bell className="w-4 h-4" />
              <span>Notifikasi</span>
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            </Link>
            
            <div className="h-px bg-white/10 my-3 mx-2"></div>
            <Link href="/dashboard/profile" className={linkClass("/dashboard/profile")} onClick={handleLinkClick}>
              <UserCheck className="w-4 h-4" />
              <span>Profil</span>
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            </Link>
          </>
        )}

      </nav>
    </div>
  );
};

export default Sidebar;
