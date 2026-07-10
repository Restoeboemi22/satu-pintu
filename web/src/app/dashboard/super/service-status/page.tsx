"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { edulockDb } from "@/lib/edulockFirebase";
import { database as gasDb, ensureGasAuth } from "@/lib/firebase";
import { callEduLockSuperApi } from "@/lib/callEduLockSuperApi";

type PaymentStatus = "PAID" | "UNPAID";
type FilterMode = "ALL" | "PAID" | "UNPAID" | "ACTIVE" | "INACTIVE";
type ServiceView = "service_status" | "active_users";

type SchoolRow = {
  schoolId: string;
  name: string;
  district: string;
  npsn: string;
  isActive: boolean;
  paymentStatus: PaymentStatus;
  confirmedAt: number | null;
  note: string;
};

type SessionRow = {
  nisn: string;
  updatedAt?: number | null;
  lastUpdated?: number | null;
  lastSeen?: number | null;
};

type AdminRuntimeRow = {
  uid: string;
  schoolId: string;
  lastLoginAt: number | null;
  isActive: boolean;
  role: "super_admin" | "admin";
  email: string;
};

type StudentRegistryRow = {
  nisn: string;
  schoolId: string;
  name: string;
  status: string;
  gasDeviceId: string;
  gasLastLoginAt: number | null;
};

type PackageActivityItem = {
  key: string;
  label: string;
  roleLabel: string;
  source: "Admin Web" | "GAS" | "EduLock";
  timestamp: number;
};

type ActiveUserRow = SchoolRow & {
  totalStudents: number;
  activatedStudents: number;
  inactiveStudents: number;
  activeUsers: number;
  recentActiveUsers: number;
  latestActivityAt: number | null;
  adminWebActiveUsers: number;
  gasActiveUsers: number;
  eduLockActiveUsers: number;
  gasActivatedStudents: number;
  eduLockActivatedStudents: number;
  packageActivities: PackageActivityItem[];
  sessions: SessionRow[];
};

type GasActivityRecord = {
  key: string;
  schoolId: string;
  label: string;
  roleLabel: string;
  lastLoginAt: number;
};

function normalize(value: unknown): string {
  return String(value || "").trim();
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  return normalize(value).toUpperCase() === "PAID" ? "PAID" : "UNPAID";
}

function formatDate(ts?: number | null): string {
  if (!ts || typeof ts !== "number") return "-";
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(ts?: number | null): string {
  if (!ts || typeof ts !== "number") return "-";
  return new Date(ts).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSessionTimestamp(session?: SessionRow | null): number {
  return Number(session?.updatedAt || session?.lastUpdated || session?.lastSeen || 0) || 0;
}

const PACKAGE_ACTIVE_WINDOW_MS = 30 * 60 * 1000;
const PACKAGE_RECENT_WINDOW_MS = 5 * 60 * 1000;

function paymentBadgeClass(status: PaymentStatus) {
  return status === "PAID"
    ? "border-emerald-400/20 bg-emerald-500/15 text-emerald-100"
    : "border-amber-400/20 bg-amber-500/15 text-amber-100";
}

function serviceBadgeClass(active: boolean) {
  return active
    ? "border-cyan-400/20 bg-cyan-500/15 text-cyan-100"
    : "border-rose-400/20 bg-rose-500/15 text-rose-100";
}

export default function ServiceStatusPage() {
  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<{ type: "" | "success" | "error"; text: string }>({ type: "", text: "" });
  const [activeView, setActiveView] = useState<ServiceView>("service_status");
  const [filterMode, setFilterMode] = useState<FilterMode>("ALL");
  const [search, setSearch] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [studentRegistryBySchool, setStudentRegistryBySchool] = useState<Record<string, StudentRegistryRow[]>>({});
  const [sessionsBySchool, setSessionsBySchool] = useState<Record<string, SessionRow[]>>({});
  const [adminProfiles, setAdminProfiles] = useState<AdminRuntimeRow[]>([]);
  const [gasActivityBySchool, setGasActivityBySchool] = useState<Record<string, GasActivityRecord[]>>({});
  const [edulockActivatedBySchool, setEdulockActivatedBySchool] = useState<Record<string, string[]>>({});
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [busyKey, setBusyKey] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    const unsub = onValue(
      ref(edulockDb, "schools"),
      (snapshot) => {
        const data = snapshot.val();
        if (!data || typeof data !== "object") {
          setRows([]);
          setLoading(false);
          return;
        }

        const nextRows = Object.entries<any>(data)
          .map(([key, value]) => {
            const serviceStatus = value?.serviceStatus && typeof value.serviceStatus === "object" ? value.serviceStatus : {};
            return {
              schoolId: normalize(value?.schoolId || key).toLowerCase(),
              name: normalize(value?.name),
              district: normalize(value?.district),
              npsn: normalize(value?.npsn),
              isActive: value?.isActive !== false,
              paymentStatus: normalizePaymentStatus(serviceStatus?.paymentStatus),
              confirmedAt: typeof serviceStatus?.confirmedAt === "number" ? serviceStatus.confirmedAt : null,
              note: normalize(serviceStatus?.note),
            } satisfies SchoolRow;
          })
          .sort((a, b) => String(a.name || a.schoolId).localeCompare(String(b.name || b.schoolId)));

        setRows(nextRows);
        setNoteDrafts((prev) => {
          const nextDrafts = { ...prev };
          for (const row of nextRows) {
            if (!(row.schoolId in nextDrafts)) {
              nextDrafts[row.schoolId] = row.note;
            }
          }
          return nextDrafts;
        });
        setLoading(false);
      },
      (e) => {
        setError(String((e as any)?.message || e || "Gagal memuat status layanan sekolah."));
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onValue(
      ref(edulockDb, "admin_profiles"),
      (snapshot) => {
        const data = snapshot.val();
        if (!data || typeof data !== "object") {
          setAdminProfiles([]);
          return;
        }
        const list = Object.entries<any>(data).map(([uid, raw]) => ({
          uid: String(raw?.uid || uid),
          schoolId: normalize(raw?.schoolId).toLowerCase(),
          lastLoginAt: typeof raw?.lastLoginAt === "number" ? raw.lastLoginAt : null,
          isActive: raw?.isActive !== false,
          role: String(raw?.role || "") === "super_admin" ? "super_admin" : "admin",
          email: normalize(raw?.email).toLowerCase(),
        }));
        setAdminProfiles(list);
      },
      (e) => setError(String((e as any)?.message || e || "Gagal memuat runtime admin sekolah."))
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    void (async () => {
      try {
        await ensureGasAuth();
        if (disposed) return;

        const unsub = onValue(
          ref(gasDb, "master_students"),
          (snapshot) => {
            const data = snapshot.val();
            if (!data || typeof data !== "object") {
              setStudentRegistryBySchool({});
              return;
            }

            const nextMap: Record<string, StudentRegistryRow[]> = {};
            for (const [key, raw] of Object.entries<any>(data)) {
              const schoolId = normalize(raw?.schoolId).toLowerCase();
              if (!schoolId) continue;
              if (!nextMap[schoolId]) nextMap[schoolId] = [];
              nextMap[schoolId].push({
                nisn: normalize(raw?.nisn || key),
                schoolId,
                name: normalize(raw?.name || raw?.nama),
                status: normalize(raw?.status),
                gasDeviceId: normalize(raw?.deviceId || raw?.device),
                gasLastLoginAt: typeof raw?.lastLoginAt === "number" ? raw.lastLoginAt : Number(raw?.lastLogin || 0) || null,
              });
            }

            for (const schoolId of Object.keys(nextMap)) {
              nextMap[schoolId].sort((a, b) => String(a.name || a.nisn).localeCompare(String(b.name || b.nisn)));
            }
            setStudentRegistryBySchool(nextMap);
          },
          (e) => setError(String((e as any)?.message || e || "Gagal memuat database siswa per sekolah."))
        );

        cleanup = () => unsub();
      } catch (e: any) {
        if (!disposed) {
          setError(String(e?.message || e || "Gagal menyiapkan akses database siswa GAS."));
        }
      }
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  useEffect(() => {
    const unsub = onValue(
      ref(edulockDb, "students"),
      (snapshot) => {
        const data = snapshot.val();
        if (!data || typeof data !== "object") {
          setEdulockActivatedBySchool({});
          return;
        }

        const nextMap: Record<string, string[]> = {};
        for (const [nisn, raw] of Object.entries<any>(data)) {
          const schoolId = normalize(raw?.schoolId).toLowerCase();
          const deviceUuid = normalize(raw?.device_uuid);
          if (!schoolId || !deviceUuid) continue;
          if (!nextMap[schoolId]) nextMap[schoolId] = [];
          nextMap[schoolId].push(String(nisn));
        }
        setEdulockActivatedBySchool(nextMap);
      },
      (e) => setError(String((e as any)?.message || e || "Gagal memuat data aktivasi EduLock siswa."))
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    const collectGasActivities = (
      data: unknown,
      roleLabel: string,
      pickLabel: (row: any, key: string) => string
    ): GasActivityRecord[] => {
      if (!data || typeof data !== "object") return [];
      return Object.entries<any>(data)
        .map(([key, raw]) => {
          const schoolId = normalize(raw?.schoolId).toLowerCase();
          const lastLoginAt = Number(raw?.lastLoginAt || raw?.lastLogin || 0) || 0;
          if (!schoolId || !lastLoginAt) return null;
          return {
            key: `${roleLabel}:${key}`,
            schoolId,
            label: pickLabel(raw, key),
            roleLabel,
            lastLoginAt,
          } satisfies GasActivityRecord;
        })
        .filter(Boolean) as GasActivityRecord[];
    };

    void (async () => {
      try {
        await ensureGasAuth();
        if (disposed) return;

        let studentsRows: GasActivityRecord[] = [];
        let teachersRows: GasActivityRecord[] = [];
        let principalsRows: GasActivityRecord[] = [];
        let staffRows: GasActivityRecord[] = [];

        const flush = () => {
          if (disposed) return;
          const nextMap: Record<string, GasActivityRecord[]> = {};
          for (const row of [...studentsRows, ...teachersRows, ...principalsRows, ...staffRows]) {
            if (!nextMap[row.schoolId]) nextMap[row.schoolId] = [];
            nextMap[row.schoolId].push(row);
          }
          for (const schoolId of Object.keys(nextMap)) {
            nextMap[schoolId].sort((a, b) => b.lastLoginAt - a.lastLoginAt);
          }
          setGasActivityBySchool(nextMap);
        };

        const unsubStudents = onValue(
          ref(gasDb, "master_students"),
          (snapshot) => {
            studentsRows = collectGasActivities(snapshot.val(), "GAS Siswa", (raw, key) => normalize(raw?.name || raw?.nama || raw?.nisn || key) || "Siswa");
            flush();
          },
          (e) => setError(String((e as any)?.message || e || "Gagal memuat aktivitas GAS siswa."))
        );

        const unsubTeachers = onValue(
          ref(gasDb, "master_teachers"),
          (snapshot) => {
            teachersRows = collectGasActivities(
              snapshot.val(),
              "GAS Guru",
              (raw, key) => normalize(raw?.name || raw?.nama || raw?.nuptk || key) || "Guru"
            );
            flush();
          },
          (e) => setError(String((e as any)?.message || e || "Gagal memuat aktivitas GAS guru."))
        );

        const unsubPrincipals = onValue(
          ref(gasDb, "principal_accounts"),
          (snapshot) => {
            principalsRows = collectGasActivities(
              snapshot.val(),
              "GAS Kepala Sekolah",
              (raw, key) => normalize(raw?.name || raw?.nama || raw?.principalName || raw?.username || key) || "Kepala Sekolah"
            );
            flush();
          },
          (e) => setError(String((e as any)?.message || e || "Gagal memuat aktivitas GAS kepala sekolah."))
        );

        const unsubStaff = onValue(
          ref(gasDb, "staff"),
          (snapshot) => {
            staffRows = collectGasActivities(
              snapshot.val(),
              "GAS Staff",
              (raw, key) => normalize(raw?.name || raw?.nama || raw?.username || key) || "Staff"
            );
            flush();
          },
          (e) => setError(String((e as any)?.message || e || "Gagal memuat aktivitas GAS staff."))
        );

        cleanup = () => {
          unsubStudents();
          unsubTeachers();
          unsubPrincipals();
          unsubStaff();
        };
      } catch (e: any) {
        if (!disposed) {
          setError(String(e?.message || e || "Gagal menyiapkan akses monitoring GAS."));
        }
      }
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  useEffect(() => {
    const unsub = onValue(
      ref(edulockDb, "active_sessions_by_school"),
      (snapshot) => {
        const data = snapshot.val();
        if (!data || typeof data !== "object") {
          setSessionsBySchool({});
          return;
        }

        const nextMap: Record<string, SessionRow[]> = {};
        for (const [schoolId, value] of Object.entries<any>(data)) {
          if (!value || typeof value !== "object") {
            nextMap[String(schoolId).trim().toLowerCase()] = [];
            continue;
          }
          const list = Object.entries<any>(value).map(([nisn, session]) => ({
            nisn: String(nisn),
            updatedAt: typeof session?.updatedAt === "number" ? session.updatedAt : null,
            lastUpdated: typeof session?.lastUpdated === "number" ? session.lastUpdated : null,
            lastSeen: typeof session?.lastSeen === "number" ? session.lastSeen : null,
          }));
          list.sort((a, b) => getSessionTimestamp(b) - getSessionTimestamp(a));
          nextMap[String(schoolId).trim().toLowerCase()] = list;
        }
        setSessionsBySchool(nextMap);
      },
      (e) => setError(String((e as any)?.message || e || "Gagal memuat sesi aktif pengguna."))
    );
    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const paid = rows.filter((row) => row.paymentStatus === "PAID").length;
    const unpaid = total - paid;
    const active = rows.filter((row) => row.isActive).length;
    const inactive = total - active;
    return { total, paid, unpaid, active, inactive };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filterMode === "PAID" && row.paymentStatus !== "PAID") return false;
      if (filterMode === "UNPAID" && row.paymentStatus !== "UNPAID") return false;
      if (filterMode === "ACTIVE" && !row.isActive) return false;
      if (filterMode === "INACTIVE" && row.isActive) return false;
      if (!keyword) return true;
      return [row.name, row.schoolId, row.npsn, row.district, row.note].some((value) =>
        String(value || "").toLowerCase().includes(keyword)
      );
    });
  }, [filterMode, rows, search]);

  const activeUserRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const now = Date.now();

    return rows
      .filter((row) => {
        if (filterMode === "ACTIVE" && !row.isActive) return false;
        if (filterMode === "INACTIVE" && row.isActive) return false;
        if (!keyword) return true;
        return [row.name, row.schoolId, row.npsn, row.district].some((value) => String(value || "").toLowerCase().includes(keyword));
      })
      .map((row) => {
        const registry = studentRegistryBySchool[row.schoolId] || [];
        const edulockActivatedSet = new Set((edulockActivatedBySchool[row.schoolId] || []).map((value) => String(value)));
        const sessions = sessionsBySchool[row.schoolId] || [];
        const activeSessionSet = new Set(sessions.map((session) => String(session.nisn)));

        const gasActivatedStudents = registry.filter(
          (student) => student.gasDeviceId.trim().length > 0 || Number(student.gasLastLoginAt || 0) > 0
        ).length;

        const eduLockActivatedStudents = registry.filter(
          (student) => edulockActivatedSet.has(student.nisn) || activeSessionSet.has(student.nisn)
        ).length;

        const activatedStudents = registry.filter((student) => {
          const gasActivated = student.gasDeviceId.trim().length > 0 || Number(student.gasLastLoginAt || 0) > 0;
          const edulockActivated = edulockActivatedSet.has(student.nisn) || activeSessionSet.has(student.nisn);
          return gasActivated || edulockActivated;
        }).length;

        const inactiveStudents = Math.max(registry.length - activatedStudents, 0);

        const adminActivities = adminProfiles
          .filter(
            (admin) =>
              admin.role === "admin" &&
              admin.isActive &&
              admin.schoolId === row.schoolId &&
              Number(admin.lastLoginAt || 0) > 0 &&
              now - Number(admin.lastLoginAt || 0) <= PACKAGE_ACTIVE_WINDOW_MS
          )
          .map((admin) => ({
            key: `admin:${admin.uid}`,
            label: admin.email || "Admin Sekolah",
            roleLabel: "Admin Web",
            source: "Admin Web" as const,
            timestamp: Number(admin.lastLoginAt || 0),
          }));

        const gasActivities = (gasActivityBySchool[row.schoolId] || [])
          .filter((item) => now - item.lastLoginAt <= PACKAGE_ACTIVE_WINDOW_MS)
          .map((item) => ({
            key: item.key,
            label: item.label,
            roleLabel: item.roleLabel,
            source: "GAS" as const,
            timestamp: item.lastLoginAt,
          }));

        const eduLockActivities = sessions
          .map((session) => ({
            key: `edulock:${row.schoolId}:${session.nisn}`,
            label: session.nisn,
            roleLabel: "EduLock Siswa",
            source: "EduLock" as const,
            timestamp: getSessionTimestamp(session),
          }))
          .filter((item) => item.timestamp > 0 && now - item.timestamp <= PACKAGE_ACTIVE_WINDOW_MS);

        const packageActivities = [...adminActivities, ...gasActivities, ...eduLockActivities].sort((a, b) => b.timestamp - a.timestamp);
        const latestActivityAt = packageActivities[0]?.timestamp || null;
        const recentActiveUsers = packageActivities.filter((item) => now - item.timestamp <= PACKAGE_RECENT_WINDOW_MS).length;
        return {
          ...row,
          totalStudents: registry.length,
          activatedStudents,
          inactiveStudents,
          activeUsers: packageActivities.length,
          recentActiveUsers,
          latestActivityAt,
          adminWebActiveUsers: adminActivities.length,
          gasActiveUsers: gasActivities.length,
          eduLockActiveUsers: eduLockActivities.length,
          gasActivatedStudents,
          eduLockActivatedStudents,
          packageActivities,
          sessions,
        } satisfies ActiveUserRow;
      })
      .sort((a, b) => {
        if (b.activatedStudents !== a.activatedStudents) return b.activatedStudents - a.activatedStudents;
        return String(a.name || a.schoolId).localeCompare(String(b.name || b.schoolId));
      });
  }, [adminProfiles, edulockActivatedBySchool, filterMode, gasActivityBySchool, rows, search, sessionsBySchool, studentRegistryBySchool]);

  useEffect(() => {
    if (activeView !== "active_users") return;
    if (activeUserRows.length === 0) {
      if (selectedSchoolId) setSelectedSchoolId("");
      return;
    }
    if (!selectedSchoolId || !activeUserRows.some((row) => row.schoolId === selectedSchoolId)) {
      setSelectedSchoolId(activeUserRows[0].schoolId);
    }
  }, [activeView, activeUserRows, selectedSchoolId]);

  const activeUserStats = useMemo(() => {
    const totalStudents = activeUserRows.reduce((sum, row) => sum + row.totalStudents, 0);
    const totalActivatedStudents = activeUserRows.reduce((sum, row) => sum + row.activatedStudents, 0);
    const totalInactiveStudents = activeUserRows.reduce((sum, row) => sum + row.inactiveStudents, 0);
    const totalActiveUsers = activeUserRows.reduce((sum, row) => sum + row.activeUsers, 0);
    const totalRecentActiveUsers = activeUserRows.reduce((sum, row) => sum + row.recentActiveUsers, 0);
    return { totalStudents, totalActivatedStudents, totalInactiveStudents, totalActiveUsers, totalRecentActiveUsers };
  }, [activeUserRows]);

  const selectedActiveUserRow = useMemo(
    () => activeUserRows.find((row) => row.schoolId === selectedSchoolId) || null,
    [activeUserRows, selectedSchoolId]
  );

  const setFlash = (type: "" | "success" | "error", text: string) => {
    setStatus({ type, text });
    if (!text) return;
    window.setTimeout(() => {
      setStatus((current) => (current.text === text ? { type: "", text: "" } : current));
    }, 2500);
  };

  const handlePaymentToggle = async (row: SchoolRow) => {
    const nextStatus: PaymentStatus = row.paymentStatus === "PAID" ? "UNPAID" : "PAID";
    const busy = `payment:${row.schoolId}`;
    setBusyKey(busy);
    try {
      await callEduLockSuperApi("POST", {
        action: "save-school-service-status",
        schoolId: row.schoolId,
        serviceStatus: {
          paymentStatus: nextStatus,
          confirmedAt: Date.now(),
        },
      });
      setFlash("success", `Status pembayaran ${row.name || row.schoolId} diperbarui.`);
    } catch (e: any) {
      setFlash("error", `Gagal menyimpan pembayaran: ${String(e?.message || e)}`);
    } finally {
      setBusyKey("");
    }
  };

  const handleServiceToggle = async (row: SchoolRow) => {
    const busy = `service:${row.schoolId}`;
    setBusyKey(busy);
    try {
      await callEduLockSuperApi("PUT", {
        action: "toggle-school-active",
        schoolId: row.schoolId,
        nextActive: !row.isActive,
      });
      setFlash("success", `Status layanan ${row.name || row.schoolId} diperbarui.`);
    } catch (e: any) {
      setFlash("error", `Gagal mengubah layanan: ${String(e?.message || e)}`);
    } finally {
      setBusyKey("");
    }
  };

  const handleSaveNote = async (row: SchoolRow) => {
    const nextNote = normalize(noteDrafts[row.schoolId]);
    const busy = `note:${row.schoolId}`;
    setBusyKey(busy);
    try {
      await callEduLockSuperApi("POST", {
        action: "save-school-service-status",
        schoolId: row.schoolId,
        serviceStatus: {
          note: nextNote,
        },
      });
      setFlash("success", `Catatan layanan ${row.name || row.schoolId} tersimpan.`);
    } catch (e: any) {
      setFlash("error", `Gagal menyimpan catatan: ${String(e?.message || e)}`);
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-xl backdrop-blur-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Status Layanan Sekolah</h1>
            <p className="mt-1 text-sm text-slate-300">
              Monitoring sederhana untuk melihat status pembayaran sekolah dan kontrol aktif/nonaktif layanan.
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-900/60"
          >
            Kembali
          </Link>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-700/50 bg-slate-900/60 p-3 shadow-xl backdrop-blur-2xl">
        <div className="flex flex-wrap gap-3">
          {[
            { key: "service_status" as const, label: "Status Layanan" },
            { key: "active_users" as const, label: "Monitoring Pengguna Aktif" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveView(item.key)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                activeView === item.key
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                  : "bg-slate-950/40 text-slate-300 hover:bg-slate-800/70 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {(activeView === "service_status"
          ? [
              { label: "TOTAL", value: stats.total, caption: "Semua sekolah" },
              { label: "SUDAH MEMBAYAR", value: stats.paid, caption: "Tercatat membayar", valueClass: "text-emerald-300" },
              { label: "BELUM MEMBAYAR", value: stats.unpaid, caption: "Perlu tindak lanjut", valueClass: "text-amber-300" },
              { label: "LAYANAN AKTIF", value: stats.active, caption: "Bisa digunakan", valueClass: "text-cyan-300" },
              { label: "LAYANAN NONAKTIF", value: stats.inactive, caption: "Sedang ditutup", valueClass: "text-rose-300" },
            ]
          : [
              { label: "TOTAL SEKOLAH", value: activeUserRows.length, caption: "Tenant yang dipantau" },
              { label: "TOTAL SISWA", value: activeUserStats.totalStudents, caption: "Terdaftar di Database Siswa", valueClass: "text-slate-100" },
              { label: "SUDAH AKTIVASI", value: activeUserStats.totalActivatedStudents, caption: "Sudah pernah bind/login", valueClass: "text-emerald-300" },
              { label: "BELUM AKTIVASI", value: activeUserStats.totalInactiveStudents, caption: "Belum ada jejak aktivasi", valueClass: "text-amber-300" },
              { label: "AKTIF OPERASIONAL", value: activeUserStats.totalActiveUsers, caption: "Realtime paket sekolah", valueClass: "text-cyan-300" },
            ]
        ).map((item) => (
          <div key={item.label} className="rounded-3xl border border-slate-700/50 bg-slate-900/60 p-5 shadow-xl backdrop-blur-2xl">
            <div className="text-xs font-semibold tracking-widest text-slate-400">{item.label}</div>
            <div className={`mt-1 text-3xl font-bold text-slate-100 ${item.valueClass || ""}`}>{item.value}</div>
            <div className="mt-1 text-sm text-slate-300">{item.caption}</div>
          </div>
        ))}
      </div>

      {error ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}
      {status.text ? (
        <div
          className={`rounded-2xl border p-4 text-sm ${
            status.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : "border-red-500/30 bg-red-500/10 text-red-100"
          }`}
        >
          {status.text}
        </div>
      ) : null}

      {activeView === "service_status" ? (
        <div className="rounded-3xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-xl backdrop-blur-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-100">Monitoring Status Pembayaran & Layanan</div>
              <div className="mt-1 text-sm text-slate-300">
                Sumber data: `schools` dengan status layanan tersimpan di dalam data sekolah.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={filterMode}
                onChange={(event) => setFilterMode(event.target.value as FilterMode)}
                className="rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
              >
                <option value="ALL">Semua</option>
                <option value="PAID">Sudah Membayar</option>
                <option value="UNPAID">Belum Membayar</option>
                <option value="ACTIVE">Layanan Aktif</option>
                <option value="INACTIVE">Layanan Nonaktif</option>
              </select>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari schoolId / nama sekolah / catatan..."
                className="w-72 rounded-xl border border-slate-700/50 bg-slate-950/40 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                  <th className="px-4 py-3">Sekolah</th>
                  <th className="px-4 py-3">NPSN / Kecamatan</th>
                  <th className="px-4 py-3">Pembayaran</th>
                  <th className="px-4 py-3">Konfirmasi Terakhir</th>
                  <th className="px-4 py-3">Catatan</th>
                  <th className="px-4 py-3">Layanan</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-300">
                      Memuat...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-300">
                      Tidak ada sekolah yang cocok dengan filter saat ini.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.schoolId} className="align-top hover:bg-white/5">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-white">{row.name || "-"}</div>
                        <div className="mt-1 text-xs text-slate-400">{row.schoolId}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-slate-100">{row.npsn || "-"}</div>
                        <div className="mt-1 text-xs text-slate-400">{row.district || "-"}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${paymentBadgeClass(row.paymentStatus)}`}>
                          {row.paymentStatus === "PAID" ? "Sudah Membayar" : "Belum Membayar"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-300">{formatDate(row.confirmedAt)}</td>
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          <input
                            value={noteDrafts[row.schoolId] ?? row.note}
                            onChange={(event) =>
                              setNoteDrafts((prev) => ({
                                ...prev,
                                [row.schoolId]: event.target.value,
                              }))
                            }
                            placeholder="Catatan singkat..."
                            className="w-44 rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveNote(row)}
                            disabled={busyKey === `note:${row.schoolId}`}
                            className="rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-900/70 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busyKey === `note:${row.schoolId}` ? "Menyimpan..." : "Simpan Catatan"}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${serviceBadgeClass(row.isActive)}`}>
                          {row.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col items-end gap-2">
                          <button
                            type="button"
                            onClick={() => handlePaymentToggle(row)}
                            disabled={busyKey === `payment:${row.schoolId}`}
                            className="rounded-xl border border-amber-400/25 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busyKey === `payment:${row.schoolId}`
                              ? "Menyimpan..."
                              : row.paymentStatus === "PAID"
                                ? "Tandai Belum Membayar"
                                : "Tandai Sudah Membayar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleServiceToggle(row)}
                            disabled={busyKey === `service:${row.schoolId}`}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                              row.isActive
                                ? "border-rose-400/25 bg-rose-500/15 text-rose-100 hover:bg-rose-500/20"
                                : "border-emerald-400/25 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/20"
                            }`}
                          >
                            {busyKey === `service:${row.schoolId}` ? "Menyimpan..." : row.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <div className="rounded-3xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-xl backdrop-blur-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-100">Monitoring Database & Aktivasi</div>
                <div className="mt-1 text-sm text-slate-300">
                  Basis utama diambil dari `Database > Siswa` tiap sekolah. Aktivasi dibaca dari jejak bind/login GAS dan aktivasi EduLock, sedangkan aktivitas realtime hanya menjadi pelengkap.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={filterMode}
                  onChange={(event) => setFilterMode(event.target.value as FilterMode)}
                  className="rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
                >
                  <option value="ALL">Semua</option>
                  <option value="ACTIVE">Layanan Aktif</option>
                  <option value="INACTIVE">Layanan Nonaktif</option>
                </select>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari schoolId / nama sekolah / NPSN..."
                  className="w-72 rounded-xl border border-slate-700/50 bg-slate-950/40 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                    <th className="px-4 py-3">Sekolah</th>
                    <th className="px-4 py-3">Total Siswa</th>
                    <th className="px-4 py-3">Sudah Aktivasi</th>
                    <th className="px-4 py-3">Belum Aktivasi</th>
                    <th className="px-4 py-3">Aktif Operasional</th>
                    <th className="px-4 py-3">Aktivitas Terakhir</th>
                    <th className="px-4 py-3 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {activeUserRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-300">
                        Tidak ada sekolah yang cocok dengan filter monitoring saat ini.
                      </td>
                    </tr>
                  ) : (
                    activeUserRows.map((row) => (
                      <tr
                        key={row.schoolId}
                        className={`cursor-pointer align-top transition hover:bg-white/5 ${
                          selectedSchoolId === row.schoolId ? "bg-blue-500/10" : ""
                        }`}
                        onClick={() => setSelectedSchoolId(row.schoolId)}
                      >
                        <td className="px-4 py-4">
                          <div className="font-semibold text-white">{row.name || "-"}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {row.schoolId} · {row.npsn || "-"}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-100">{row.totalStudents}</td>
                        <td className="px-4 py-4">
                          <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">
                            {row.activatedStudents} siswa
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-200">{row.inactiveStudents}</td>
                        <td className="px-4 py-4 text-slate-200">{row.activeUsers}</td>
                        <td className="px-4 py-4 text-slate-300">{formatDateTime(row.latestActivityAt)}</td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedSchoolId(row.schoolId)}
                            className="rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-900/70"
                          >
                            Lihat
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-xl backdrop-blur-2xl">
            <div className="text-sm font-semibold text-slate-100">Detail Sekolah</div>
            <div className="mt-1 text-sm text-slate-300">Klik sekolah pada tabel kiri untuk melihat ringkasan database siswa, aktivasi, dan aktivitas operasionalnya.</div>

            {selectedActiveUserRow ? (
              <div className="mt-6 space-y-5">
                <div>
                  <div className="text-lg font-bold text-white">{selectedActiveUserRow.name || "-"}</div>
                  <div className="mt-1 text-xs uppercase tracking-widest text-slate-400">
                    {selectedActiveUserRow.schoolId} · {selectedActiveUserRow.npsn || "-"} · {selectedActiveUserRow.district || "-"}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold tracking-widest text-slate-400">TOTAL SISWA</div>
                    <div className="mt-2 text-2xl font-bold text-white">{selectedActiveUserRow.totalStudents}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold tracking-widest text-slate-400">SUDAH AKTIVASI</div>
                    <div className="mt-2 text-2xl font-bold text-emerald-300">{selectedActiveUserRow.activatedStudents}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold tracking-widest text-slate-400">BELUM AKTIVASI</div>
                    <div className="mt-2 text-2xl font-bold text-amber-300">{selectedActiveUserRow.inactiveStudents}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold tracking-widest text-slate-400">AKTIF OPERASIONAL</div>
                    <div className="mt-2 text-2xl font-bold text-cyan-300">{selectedActiveUserRow.activeUsers}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold tracking-widest text-slate-400">AKTIF 5 MENIT</div>
                    <div className="mt-2 text-2xl font-bold text-violet-300">{selectedActiveUserRow.recentActiveUsers}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold tracking-widest text-slate-400">AKTIVASI GAS</div>
                    <div className="mt-2 text-2xl font-bold text-sky-300">{selectedActiveUserRow.gasActivatedStudents}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold tracking-widest text-slate-400">AKTIVASI EDULOCK</div>
                    <div className="mt-2 text-2xl font-bold text-teal-300">{selectedActiveUserRow.eduLockActivatedStudents}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold tracking-widest text-slate-400">ADMIN WEB AKTIF</div>
                    <div className="mt-2 text-2xl font-bold text-cyan-300">{selectedActiveUserRow.adminWebActiveUsers}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs font-semibold tracking-widest text-slate-400">AKTIVITAS TERAKHIR</div>
                  <div className="mt-2 text-sm text-slate-200">{formatDateTime(selectedActiveUserRow.latestActivityAt)}</div>
                  <div className="mt-2 text-xs text-slate-400">
                    `Sudah Aktivasi` dihitung dari siswa resmi pada Database Siswa yang sudah punya jejak bind/login GAS atau aktivasi EduLock. `Aktif Operasional` tetap menampilkan aktivitas realtime paket sekolah.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs font-semibold tracking-widest text-slate-400">AKTIVITAS TERBARU</div>
                  <div className="mt-3 space-y-2">
                    {selectedActiveUserRow.packageActivities.length === 0 ? (
                      <div className="text-sm text-slate-400">Belum ada aktivitas paket sekolah yang terdeteksi untuk sekolah ini.</div>
                    ) : (
                      selectedActiveUserRow.packageActivities.slice(0, 10).map((activity) => (
                        <div key={activity.key} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2">
                          <div>
                            <div className="text-sm font-semibold text-slate-100">{activity.label}</div>
                            <div className="text-xs text-slate-400">
                              {activity.source} · {activity.roleLabel}
                            </div>
                          </div>
                          <div className="text-right text-xs text-slate-300">{formatDateTime(activity.timestamp)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                Belum ada sekolah yang dipilih atau belum ada data database siswa yang bisa diringkas saat ini.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
