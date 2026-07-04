"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import PortalGateState from "@/components/ui/PortalGateState";
import { usePortalGuard } from "@/hooks/usePortalGuard";
import { ADMIN_ROLES, getPortalRoleLabel } from "@/lib/portalAccess";
import { useEduLockAuth } from "@/lib/useEduLockAuth";
import { ArrowRight, Database, LayoutDashboard, Lock, Rocket, Activity, BookOpen } from "lucide-react";
import { limitToLast, onValue, orderByChild, query, ref } from "firebase/database";
import { edulockDb } from "@/lib/edulockFirebase";
import { database, ensureGasAuth } from "@/lib/firebase";
import { useAuthStore } from "@/store/useAuthStore";

type SchoolRegistryItem = {
  schoolId: string;
  name: string;
  isActive: boolean;
  npsn: string;
  authEmail: string;
  adminEmail: string;
  adminAccessActive: boolean;
};

type SuperIntegrationSummary = {
  loading: boolean;
  tenantsTotal: number;
  tenantsActive: number;
  adminSchools: number;
  principalsTotal: number;
  activeSessions: number;
  violationsTotal: number;
  attendanceToday: number;
  attendanceSchools: number;
  attendanceLastAt: number | null;
  prayerToday: number;
  prayerSchools: number;
  prayerLastAt: number | null;
  discipline7d: number;
  disciplineSchools: number;
  disciplineLastAt: number | null;
  literacyReportsMonth: number;
  literacyReportsPending: number;
  literacyTasksActive: number;
  lenteraConfigured: number;
  lenteraLastAt: number | null;
  missingAdmin: string[];
  missingPrincipal: string[];
  missingAttendance: string[];
  missingPrayer: string[];
  missingLentera: string[];
  recentEvents: Array<{ id: string; at: number; message: string; schoolId: string }>;
};

const initialSuperIntegrationSummary: SuperIntegrationSummary = {
  loading: true,
  tenantsTotal: 0,
  tenantsActive: 0,
  adminSchools: 0,
  principalsTotal: 0,
  activeSessions: 0,
  violationsTotal: 0,
  attendanceToday: 0,
  attendanceSchools: 0,
  attendanceLastAt: null,
  prayerToday: 0,
  prayerSchools: 0,
  prayerLastAt: null,
  discipline7d: 0,
  disciplineSchools: 0,
  disciplineLastAt: null,
  literacyReportsMonth: 0,
  literacyReportsPending: 0,
  literacyTasksActive: 0,
  lenteraConfigured: 0,
  lenteraLastAt: null,
  missingAdmin: [],
  missingPrincipal: [],
  missingAttendance: [],
  missingPrayer: [],
  missingLentera: [],
  recentEvents: [],
};

function normalizeSchoolId(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function schoolHasAdminLoginConfig(school: Pick<SchoolRegistryItem, "npsn" | "authEmail" | "adminEmail">): boolean {
  return Boolean(normalizeText(school.authEmail) || normalizeText(school.adminEmail) || normalizeText(school.npsn));
}

function getNumericTimestamp(source: Record<string, any>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function formatRelativeTime(ts: number | null): string {
  if (!ts) return "Belum ada";
  return new Date(ts).toLocaleString("id-ID");
}

function isSchoolAdminVisiblePlatformEvent(message: string): boolean {
  const normalized = normalizeText(message).toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("akun kepala sekolah dibuat")) return false;
  if (normalized.includes("akun kepala sekolah diperbarui")) return false;
  if (normalized.includes("akun kepala sekolah dihapus")) return false;
  if (normalized.includes("reset device kepala sekolah")) return false;
  return true;
}

function buildStudentSchoolMap(raw: any): Map<string, string> {
  const map = new Map<string, string>();
  if (!raw || typeof raw !== "object") return map;
  for (const [key, value] of Object.entries<any>(raw)) {
    const schoolId = normalizeSchoolId(value?.schoolId);
    if (!schoolId) continue;
    const candidates = [
      normalizeText(key),
      normalizeText(value?.id),
      normalizeText(value?.nisn),
      normalizeText(value?.username),
    ].filter(Boolean);
    candidates.forEach((candidate) => map.set(candidate, schoolId));
  }
  return map;
}

function resolveRecordSchoolId(item: any, studentSchoolMap: Map<string, string>): string {
  return (
    normalizeSchoolId(item?.schoolId) ||
    normalizeSchoolId(studentSchoolMap.get(normalizeText(item?.studentId))) ||
    normalizeSchoolId(studentSchoolMap.get(normalizeText(item?.nisn))) ||
    ""
  );
}

function pickSchoolNames(
  schools: SchoolRegistryItem[],
  coveredSchoolIds: Set<string>,
  limit = 4
): string[] {
  return schools
    .filter((school) => !coveredSchoolIds.has(normalizeSchoolId(school.schoolId)))
    .slice(0, limit)
    .map((school) => school.name || school.schoolId);
}

export default function AdminOneDoorPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { logout: logoutPortal } = useAuthStore();
  const returnTo = pathname || "/admin";
  const { user, status, isAllowed } = usePortalGuard({
    allowedRoles: ADMIN_ROLES,
    returnTo,
    unauthenticatedRedirectTo: `/admin/login?returnTo=${encodeURIComponent(returnTo)}`,
    unauthorizedRedirectTo: "/dashboard",
  });
  const { isLoading: isEduLockAuthLoading, logout: logoutEduLock } = useEduLockAuth();
  const [platformEvents, setPlatformEvents] = useState<Array<{ id: string; at: number; message: string }>>([]);
  const [superIntegration, setSuperIntegration] = useState<SuperIntegrationSummary>(initialSuperIntegrationSummary);
  const portalLinks = useMemo(() => {
    const databaseHref = user?.role === "super_admin" ? "/super-admin/database" : "/admin/students?sub=students";
    const gasHref = user?.role === "super_admin" ? "/dashboard/super" : "/dashboard/students";
    const edulockHref = "/edulock";
    const lenteraHref = "/admin/lentera";

    return {
      overviewHref: pathname ? `${pathname}#overview` : "#overview",
      databaseHref,
      gasHref,
      edulockHref,
      lenteraHref,
    };
  }, [pathname, user?.role]);

  const sideMenuItems = useMemo(() => {
    if (user?.role === "super_admin") {
      return [
        { href: portalLinks.databaseHref, label: "DATABASE", icon: Database },
        { href: portalLinks.gasHref, label: "GAS", icon: Rocket },
        { href: portalLinks.edulockHref, label: "EduLock", icon: Lock },
        { href: "/dashboard/super/service-status", label: "Status Layanan Sekolah", icon: Activity },
      ];
    }

    return [
      { href: portalLinks.databaseHref, label: "DATABASE", icon: Database },
      { href: portalLinks.gasHref, label: "GAS", icon: Rocket },
      { href: portalLinks.edulockHref, label: "EduLock", icon: Lock },
      { href: portalLinks.lenteraHref, label: "Lentera Digital", icon: BookOpen },
    ];
  }, [portalLinks.databaseHref, portalLinks.edulockHref, portalLinks.gasHref, portalLinks.lenteraHref, user?.role]);

  const handleLogout = async () => {
    try {
      await logoutEduLock().catch(() => {});
    } finally {
      logoutPortal();
      router.replace("/admin/login?returnTo=/admin");
    }
  };

  useEffect(() => {
    if (!isAllowed || !user || isEduLockAuthLoading) return;
    if (user.role !== "admin") {
      setPlatformEvents([]);
      return;
    }
    const schoolId = String(user.schoolId || "").trim().toLowerCase();
    if (!schoolId) {
      setPlatformEvents([]);
      return;
    }
    const q = query(ref(edulockDb, "platform_events"), orderByChild("at"), limitToLast(25));
    const unsub = onValue(q, (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data !== "object") {
        setPlatformEvents([]);
        return;
      }
      const list = Object.values<any>(data)
        .map((v) => ({
          id: String(v?.id || ""),
          at: Number(v?.at || 0) || 0,
          schoolId: String(v?.schoolId || "").trim().toLowerCase(),
          message: String(v?.message || ""),
        }))
        .filter((e) => e.at && e.message && e.schoolId === schoolId)
        .filter((e) => isSchoolAdminVisiblePlatformEvent(e.message))
        .sort((a, b) => b.at - a.at)
        .slice(0, 6)
        .map(({ id, at, message }) => ({ id, at, message }));
      setPlatformEvents(list);
    });
    return () => unsub();
  }, [isAllowed, user, isEduLockAuthLoading]);

  useEffect(() => {
    if (!isAllowed || !user || isEduLockAuthLoading) return;
    if (user.role !== "super_admin") {
      setSuperIntegration(initialSuperIntegrationSummary);
      return;
    }

    let cancelled = false;
    const unsubscribers: Array<() => void> = [];
    const cache: Record<string, any> = {
      schools: null,
      admins: null,
      principals: null,
      activeSessions: null,
      violations: null,
      students: null,
      attendance: null,
      prayer: null,
      discipline: null,
      literacyReports: null,
      literacyTasks: null,
      lenteraSettings: null,
      platformEvents: null,
    };

    const recompute = () => {
      if (cancelled) return;

      const schools = Object.entries<any>(cache.schools || {}).map(([key, value]) => ({
        schoolId: normalizeText(value?.schoolId || key),
        name: normalizeText(value?.name),
        isActive: value?.isActive !== false,
        npsn: normalizeText(value?.npsn),
        authEmail: normalizeText(value?.authEmail),
        adminEmail: normalizeText(value?.adminEmail),
        adminAccessActive: value?.adminAccessActive !== false,
      }));
      const activeSchools = schools.filter((school) => school.isActive);

      const adminSchoolIds = new Set(
        activeSchools
          .filter((school) => school.adminAccessActive && schoolHasAdminLoginConfig(school))
          .map((school) => normalizeSchoolId(school.schoolId))
          .filter(Boolean)
      );
      const principalSchoolIds = new Set(
        Object.values<any>(cache.principals || {})
          .filter((item) => item?.isActive !== false)
          .map((item) => normalizeSchoolId(item?.schoolId))
          .filter(Boolean)
      );
      const studentSchoolMap = buildStudentSchoolMap(cache.students);
      const activeSchoolIds = new Set(activeSchools.map((school) => normalizeSchoolId(school.schoolId)).filter(Boolean));

      const now = Date.now();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

      let attendanceToday = 0;
      let attendanceLastAt: number | null = null;
      const attendanceSchools = new Set<string>();
      for (const item of Object.values<any>(cache.attendance || {})) {
        const ts = getNumericTimestamp(item || {}, ["updatedAt", "createdAt", "date"]);
        const schoolId = resolveRecordSchoolId(item, studentSchoolMap);
        if (schoolId) attendanceSchools.add(schoolId);
        if (ts && ts >= startOfToday.getTime()) attendanceToday += 1;
        if (ts && (!attendanceLastAt || ts > attendanceLastAt)) attendanceLastAt = ts;
      }

      let prayerToday = 0;
      let prayerLastAt: number | null = null;
      const prayerSchools = new Set<string>();
      for (const item of Object.values<any>(cache.prayer || {})) {
        const ts = getNumericTimestamp(item || {}, ["updatedAt", "createdAt", "date"]);
        const schoolId = resolveRecordSchoolId(item, studentSchoolMap);
        if (schoolId) prayerSchools.add(schoolId);
        if (ts && ts >= startOfToday.getTime()) prayerToday += 1;
        if (ts && (!prayerLastAt || ts > prayerLastAt)) prayerLastAt = ts;
      }

      let discipline7d = 0;
      let disciplineLastAt: number | null = null;
      const disciplineSchools = new Set<string>();
      for (const item of Object.values<any>(cache.discipline || {})) {
        const ts = getNumericTimestamp(item || {}, ["updatedAt", "createdAt", "date"]);
        const schoolId = resolveRecordSchoolId(item, studentSchoolMap);
        if (schoolId) disciplineSchools.add(schoolId);
        if (ts && ts >= sevenDaysAgo) discipline7d += 1;
        if (ts && (!disciplineLastAt || ts > disciplineLastAt)) disciplineLastAt = ts;
      }

      let literacyReportsMonth = 0;
      let literacyReportsPending = 0;
      let literacyLastAt: number | null = null;
      for (const item of Object.values<any>(cache.literacyReports || {})) {
        const ts = getNumericTimestamp(item || {}, ["updatedAt", "submissionDate", "createdAt"]);
        if (ts && ts >= startOfMonth.getTime()) literacyReportsMonth += 1;
        if (normalizeText(item?.status) !== "REVIEWED") literacyReportsPending += 1;
        if (ts && (!literacyLastAt || ts > literacyLastAt)) literacyLastAt = ts;
      }

      let literacyTasksActive = 0;
      for (const item of Object.values<any>(cache.literacyTasks || {})) {
        if (item?.isActive) literacyTasksActive += 1;
      }

      const lenteraSettingsEntries = Object.entries<any>(cache.lenteraSettings || {});
      let lenteraLastAt: number | null = literacyLastAt;
      const lenteraConfigured = lenteraSettingsEntries.length;
      const lenteraSchools = new Set(
        lenteraSettingsEntries.map(([schoolId]) => normalizeSchoolId(schoolId)).filter(Boolean)
      );
      for (const [, value] of lenteraSettingsEntries) {
        const ts = getNumericTimestamp(value || {}, ["updatedAt"]);
        if (ts && (!lenteraLastAt || ts > lenteraLastAt)) lenteraLastAt = ts;
      }

      const recentEvents = Object.values<any>(cache.platformEvents || {})
        .map((item) => ({
          id: normalizeText(item?.id),
          at: Number(item?.at || 0) || 0,
          message: normalizeText(item?.message),
          schoolId: normalizeSchoolId(item?.schoolId),
        }))
        .filter((item) => item.at && item.message)
        .sort((a, b) => b.at - a.at)
        .slice(0, 5);

      setSuperIntegration({
        loading: false,
        tenantsTotal: schools.length,
        tenantsActive: activeSchools.length,
        adminSchools: adminSchoolIds.size,
        principalsTotal: principalSchoolIds.size,
        activeSessions: Object.keys(cache.activeSessions || {}).length,
        violationsTotal: Object.keys(cache.violations || {}).length,
        attendanceToday,
        attendanceSchools: attendanceSchools.size,
        attendanceLastAt,
        prayerToday,
        prayerSchools: prayerSchools.size,
        prayerLastAt,
        discipline7d,
        disciplineSchools: disciplineSchools.size,
        disciplineLastAt,
        literacyReportsMonth,
        literacyReportsPending,
        literacyTasksActive,
        lenteraConfigured,
        lenteraLastAt,
        missingAdmin: pickSchoolNames(activeSchools, adminSchoolIds),
        missingPrincipal: pickSchoolNames(activeSchools, principalSchoolIds),
        missingAttendance: pickSchoolNames(
          activeSchools,
          new Set([...attendanceSchools].filter((schoolId) => activeSchoolIds.has(schoolId)))
        ),
        missingPrayer: pickSchoolNames(
          activeSchools,
          new Set([...prayerSchools].filter((schoolId) => activeSchoolIds.has(schoolId)))
        ),
        missingLentera: pickSchoolNames(
          activeSchools,
          new Set([...lenteraSchools].filter((schoolId) => activeSchoolIds.has(schoolId)))
        ),
        recentEvents,
      });
    };

    const attachRealtimeListeners = () => {
      unsubscribers.push(onValue(ref(edulockDb, "schools"), (snapshot) => {
        cache.schools = snapshot.val();
        recompute();
      }));
      unsubscribers.push(onValue(ref(edulockDb, "active_sessions"), (snapshot) => {
        cache.activeSessions = snapshot.val();
        recompute();
      }));
      unsubscribers.push(onValue(ref(edulockDb, "violations"), (snapshot) => {
        cache.violations = snapshot.val();
        recompute();
      }));
      unsubscribers.push(onValue(query(ref(edulockDb, "platform_events"), orderByChild("at"), limitToLast(40)), (snapshot) => {
        cache.platformEvents = snapshot.val();
        recompute();
      }));

      unsubscribers.push(onValue(ref(database, "principal_accounts"), (snapshot) => {
        cache.principals = snapshot.val();
        recompute();
      }));
      unsubscribers.push(onValue(ref(database, "master_students"), (snapshot) => {
        cache.students = snapshot.val();
        recompute();
      }));
      unsubscribers.push(onValue(ref(database, "attendance"), (snapshot) => {
        cache.attendance = snapshot.val();
        recompute();
      }));
      unsubscribers.push(onValue(ref(database, "prayer_attendance"), (snapshot) => {
        cache.prayer = snapshot.val();
        recompute();
      }));
      unsubscribers.push(onValue(ref(database, "discipline_records"), (snapshot) => {
        cache.discipline = snapshot.val();
        recompute();
      }));
      unsubscribers.push(onValue(ref(database, "literacy_reports"), (snapshot) => {
        cache.literacyReports = snapshot.val();
        recompute();
      }));
      unsubscribers.push(onValue(ref(database, "literacy_tasks"), (snapshot) => {
        cache.literacyTasks = snapshot.val();
        recompute();
      }));
      unsubscribers.push(onValue(ref(database, "lentera_settings"), (snapshot) => {
        cache.lenteraSettings = snapshot.val();
        recompute();
      }));
    };

    ensureGasAuth()
      .then(() => {
        if (cancelled) return;
        attachRealtimeListeners();
      })
      .catch(() => {
        if (cancelled) return;
        setSuperIntegration((prev) => ({ ...prev, loading: false }));
      });

    return () => {
      cancelled = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [isAllowed, isEduLockAuthLoading, user]);

  if (status === "pending" || isEduLockAuthLoading) {
    return <PortalGateState title="Memuat Portal Satu Pintu..." description="Menyiapkan sesi admin dan integrasi portal." />;
  }

  if (!isAllowed) {
    const isUnauthorized = status === "unauthorized";
    return (
      <PortalGateState
        title={isUnauthorized ? "Akses Portal Satu Pintu ditolak." : "Mengarahkan ke login Portal..."}
        description={
          isUnauthorized
            ? `Role ${getPortalRoleLabel(user?.role)} tidak memiliki akses ke halaman admin ini.`
            : "Silakan login terlebih dahulu untuk membuka Portal Satu Pintu."
        }
        actionHref={`/admin/login?returnTo=${encodeURIComponent(returnTo)}`}
        actionLabel="Ke Login Admin"
      />
    );
  }

  return (
    <div
      className="min-h-screen px-4 py-6 sm:px-6"
      style={{
        background: "linear-gradient(135deg, #0b1228 0%, #121a43 50%, #081121 100%)",
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="w-full lg:sticky lg:top-6 lg:w-60 lg:flex-none">
          <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4 shadow-2xl backdrop-blur">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 shadow-lg">
                  <Image src="/PortalKita.png" alt="Dashboard Satu Pintu" width={40} height={40} className="object-contain" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Dashboard Satu Pintu</div>
                  <div className="text-xs text-slate-400">{user?.role === "super_admin" ? "Super Admin" : "Admin Sekolah"}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Logged In As:</div>
              <div className="mt-2 text-sm font-semibold text-white">{user?.name}</div>
              <div className="text-xs font-semibold uppercase text-blue-300">{getPortalRoleLabel(user?.role)}</div>
              {user?.schoolName ? <div className="mt-1 text-xs text-slate-400">{user.schoolName}</div> : null}
            </div>

            <div className="mt-4 space-y-2">
              <a
                href={portalLinks.overviewHref}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                <span className="flex items-center gap-3">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard Overview
                </span>
                <ArrowRight className="h-4 w-4 opacity-70" />
              </a>
            </div>

            <div className="mt-4">
              <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Menu</div>
              <div className="mt-2 space-y-2">
                {sideMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isStatusMenu = item.label === "Status Layanan Sekolah";
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10"
                    >
                      <span className="flex items-center gap-3">
                        {isStatusMenu ? (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-cyan-400/20 bg-cyan-500/10 shadow-sm shadow-cyan-500/10">
                            <Image src="/status-layanan-sekolah.png" alt="Status Layanan Sekolah" width={24} height={24} className="h-5 w-5 object-contain" />
                          </span>
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                        {item.label}
                      </span>
                      <ArrowRight className="h-4 w-4 opacity-60" />
                    </Link>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="mt-6 flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            >
              Logout
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl backdrop-blur sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-semibold tracking-widest text-slate-400">PORTAL</div>
                  <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">Dashboard Satu Pintu</h1>
                  <p className="mt-1 text-sm text-slate-300">
                    {user?.role === "super_admin"
                      ? "Pusat monitoring dan kontrol lintas tenant."
                      : "Pintu masuk ke DATABASE, GAS, EduLock, dan Lentera."}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100">
                  {user?.role === "super_admin"
                    ? "SUPER ADMIN"
                    : user?.schoolName
                      ? `ADMIN SEKOLAH: ${String(user.schoolName).toUpperCase()}`
                      : "ADMIN SEKOLAH"}
                </div>
              </div>
            </div>

            {user?.role === "super_admin" && (
              <section id="overview" className="scroll-mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl backdrop-blur">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold tracking-widest text-slate-400">DASHBOARD OVERVIEW</div>
                    <div className="mt-2 text-sm font-semibold text-white">Ringkasan Integrasi Antar Modul</div>
                    <div className="mt-1 text-sm text-slate-300">
                      Monitoring realtime lintas tenant untuk tenant registry, EduLock, presensi, sholat, kedisiplinan, dan Lentera.
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {superIntegration.loading ? "Memuat data modul..." : `${superIntegration.tenantsActive} tenant aktif dipantau`}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold tracking-widest text-slate-400">TENANT & AKSES</div>
                    <div className="mt-3 space-y-1 text-sm text-slate-200">
                      <div>{superIntegration.tenantsTotal} sekolah, {superIntegration.tenantsActive} aktif</div>
                      <div>{superIntegration.adminSchools} sekolah punya akun admin yang dibuka dari registry tenant</div>
                      <div>{superIntegration.principalsTotal} sekolah sudah punya akun kepala sekolah</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold tracking-widest text-slate-400">EDULOCK</div>
                    <div className="mt-3 space-y-1 text-sm text-slate-200">
                      <div>{superIntegration.activeSessions} sesi perangkat aktif</div>
                      <div>{superIntegration.violationsTotal} violation log tercatat</div>
                      <div>{superIntegration.recentEvents.length} event platform terbaru siap ditinjau</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold tracking-widest text-slate-400">PRESENSI SISWA</div>
                    <div className="mt-3 space-y-1 text-sm text-slate-200">
                      <div>{superIntegration.attendanceToday} log hari ini</div>
                      <div>{superIntegration.attendanceSchools} sekolah mengirim data</div>
                      <div>Update terakhir: {formatRelativeTime(superIntegration.attendanceLastAt)}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold tracking-widest text-slate-400">PRESENSI SHOLAT</div>
                    <div className="mt-3 space-y-1 text-sm text-slate-200">
                      <div>{superIntegration.prayerToday} log hari ini</div>
                      <div>{superIntegration.prayerSchools} sekolah mengirim data</div>
                      <div>Update terakhir: {formatRelativeTime(superIntegration.prayerLastAt)}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold tracking-widest text-slate-400">KEDISIPLINAN</div>
                    <div className="mt-3 space-y-1 text-sm text-slate-200">
                      <div>{superIntegration.discipline7d} record dalam 7 hari</div>
                      <div>{superIntegration.disciplineSchools} sekolah tercakup</div>
                      <div>Update terakhir: {formatRelativeTime(superIntegration.disciplineLastAt)}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold tracking-widest text-slate-400">LENTERA</div>
                    <div className="mt-3 space-y-1 text-sm text-slate-200">
                      <div>{superIntegration.literacyReportsMonth} laporan literasi bulan ini</div>
                      <div>{superIntegration.literacyReportsPending} laporan masih pending, {superIntegration.literacyTasksActive} task aktif</div>
                      <div>{superIntegration.lenteraConfigured} sekolah sudah punya settings Lentera</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-semibold text-white">Titik Integrasi Yang Perlu Ditindak</div>
                    <div className="mt-3 space-y-3 text-sm text-slate-200">
                      <div>
                        <span className="font-semibold text-slate-100">Belum ada admin:</span>{" "}
                        {superIntegration.missingAdmin.length > 0
                          ? superIntegration.missingAdmin.join(", ")
                          : "semua tenant aktif sudah punya konfigurasi akun admin"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-100">Belum ada akun kepsek:</span>{" "}
                        {superIntegration.missingPrincipal.length > 0 ? superIntegration.missingPrincipal.join(", ") : "semua tenant aktif sudah punya akun kepala sekolah"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-100">Belum ada presensi hari ini:</span>{" "}
                        {superIntegration.missingAttendance.length > 0 ? superIntegration.missingAttendance.join(", ") : "semua tenant aktif sudah mengirim presensi"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-100">Belum ada data sholat hari ini:</span>{" "}
                        {superIntegration.missingPrayer.length > 0 ? superIntegration.missingPrayer.join(", ") : "semua tenant aktif sudah mengirim data sholat"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-100">Belum ada settings Lentera:</span>{" "}
                        {superIntegration.missingLentera.length > 0 ? superIntegration.missingLentera.join(", ") : "semua tenant aktif sudah punya settings Lentera"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-semibold text-white">Aktivitas Platform Terbaru</div>
                    <div className="mt-3 space-y-2">
                      {superIntegration.recentEvents.length > 0 ? (
                        superIntegration.recentEvents.map((event) => (
                          <div key={`${event.id}-${event.at}`} className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                            <div className="text-xs text-slate-400">{new Date(event.at).toLocaleString("id-ID")}</div>
                            <div className="mt-1 text-sm text-slate-100">{event.message}</div>
                            <div className="mt-1 text-xs text-slate-500">{event.schoolId || "global"}</div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-8 text-center text-sm text-slate-400">
                          Belum ada event platform terbaru.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {user?.role === "admin" && platformEvents.length > 0 && (
              <section id="overview" className="scroll-mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl backdrop-blur">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold tracking-widest text-slate-400">DASHBOARD OVERVIEW</div>
                    <div className="mt-2 text-sm font-semibold text-white">Aktivitas Sistem (Realtime)</div>
                    <div className="mt-1 text-sm text-slate-300">Update dari Super Admin untuk sekolah Anda.</div>
                  </div>
                  <div className="text-xs text-slate-400">{platformEvents.length} event</div>
                </div>
                <div className="mt-4 space-y-2">
                  {platformEvents.map((e) => (
                    <div key={e.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                      <div className="text-xs text-slate-400">{new Date(e.at).toLocaleString("id-ID")}</div>
                      <div className="mt-1">{e.message}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
        </main>
      </div>
    </div>
  );
}
