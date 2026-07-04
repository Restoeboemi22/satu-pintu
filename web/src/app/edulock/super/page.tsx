"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onValue, ref, remove, set, update } from "firebase/database";
import { edulockAuth, edulockDb } from "@/lib/edulockFirebase";
import { useEduLockAuth } from "@/lib/useEduLockAuth";
import QRCode from "react-qr-code";
import EduLockWorkspaceShell, { type EduLockNavGroup } from "@/components/edulock/EduLockWorkspaceShell";
import {
  Activity,
  Command,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  MapPinned,
  Network,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";

type Section =
  | "dashboard"
  | "monitoring"
  | "tenants"
  | "admins"
  | "policy_center"
  | "zone_templates"
  | "device_fleet"
  | "command_center"
  | "izin_exception"
  | "audit"
  | "integrations"
  | "support"
  | "settings";

const SUPER_NAV_GROUPS: EduLockNavGroup[] = [
  {
    label: "OVERVIEW",
    items: [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { key: "monitoring", label: "Realtime Monitoring", icon: Activity },
    ],
  },
  {
    label: "OPERASIONAL",
    items: [
      { key: "tenants", label: "Tenants", icon: Network },
      { key: "admins", label: "Admin Sekolah", icon: Users },
      { key: "command_center", label: "Command Center", icon: Command },
    ],
  },
  {
    label: "KEAMANAN",
    items: [
      { key: "policy_center", label: "Policy Center", icon: Shield },
      { key: "zone_templates", label: "Zone Templates", icon: MapPinned },
      { key: "device_fleet", label: "Device Fleet", icon: ShieldCheck },
      { key: "izin_exception", label: "Izin / Exception", icon: Lock },
      { key: "audit", label: "Audit", icon: Workflow },
    ],
  },
  {
    label: "KONFIGURASI",
    items: [
      { key: "integrations", label: "Integrations", icon: Network },
      { key: "support", label: "Support", icon: LifeBuoy },
      { key: "settings", label: "Settings", icon: Settings },
    ],
  },
];

function isSuperSection(value: string): value is Section {
  return [
    "dashboard",
    "monitoring",
    "tenants",
    "admins",
    "policy_center",
    "zone_templates",
    "device_fleet",
    "command_center",
    "izin_exception",
    "audit",
    "integrations",
    "support",
    "settings",
  ].includes(value);
}

function formatTs(ts: number | null | undefined): string {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString("id-ID");
  } catch {
    return "-";
  }
}

function normalize(value: unknown): string {
  return String(value || "").trim();
}

type SchoolRow = {
  schoolId: string;
  name: string;
  district: string;
  npsn: string;
  authEmail: string;
  adminEmail: string;
  backupEmail: string;
  isActive: boolean;
  adminAccessActive: boolean;
  updatedAt?: number | null;
  createdAt?: number | null;
};

type RuntimeAdminRow = {
  uid: string;
  email: string;
  role: "super_admin" | "admin";
  isActive: boolean;
  schoolId: string;
  schoolName: string;
  lastLoginAt?: number | null;
  mustChangePassword: boolean;
};

type SchoolAdminAccessRow = {
  schoolId: string;
  schoolName: string;
  npsn: string;
  loginIdentifier: string;
  resetEmail: string;
  schoolActive: boolean;
  accessActive: boolean;
  runtimeUid: string;
  runtimeEmail: string;
  runtimeLastLoginAt?: number | null;
  runtimeMustChangePassword: boolean;
};

function getSchoolAdminResetEmail(school: Pick<SchoolRow, "authEmail" | "adminEmail">): string {
  const authEmail = normalize(school.authEmail).toLowerCase();
  const adminEmail = normalize(school.adminEmail).toLowerCase();
  if (authEmail.includes("@") && !authEmail.endsWith("@edulock.local")) return authEmail;
  if (adminEmail.includes("@") && !adminEmail.endsWith("@edulock.local")) return adminEmail;
  return "";
}

function getSchoolAdminLoginIdentifier(school: Pick<SchoolRow, "npsn" | "authEmail" | "adminEmail">): string {
  const npsn = normalize(school.npsn);
  if (npsn) return npsn;
  return "";
}

function schoolHasAdminLoginConfig(school: Pick<SchoolRow, "npsn" | "authEmail" | "adminEmail">): boolean {
  return Boolean(normalize(school.npsn));
}

function getSchoolAdminSystemEmail(npsn: unknown): string {
  const normalized = normalize(npsn);
  return normalized ? `${normalized}@edulock.local` : "";
}

function hasOperationalRuntime(row?: Pick<SchoolAdminAccessRow, "runtimeUid" | "runtimeLastLoginAt"> | null): boolean {
  if (!row) return false;
  if (normalize(row.runtimeUid)) return true;
  return Number(row.runtimeLastLoginAt || 0) > 0;
}

function EduLockSuperAdminPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role, profile, isLoading } = useEduLockAuth();

  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [runtimeAdmins, setRuntimeAdmins] = useState<RuntimeAdminRow[]>([]);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [presenceByNisn, setPresenceByNisn] = useState<Record<string, any>>({});

  const [adminApiConfigUrl, setAdminApiConfigUrl] = useState("");
  const [adminApiInput, setAdminApiInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "" | "success" | "error"; text: string }>({ type: "", text: "" });

  const [monitoringSchoolId, setMonitoringSchoolId] = useState("");
  const [uninstallSchoolId, setUninstallSchoolId] = useState("");
  const [uninstallDurationMinutes, setUninstallDurationMinutes] = useState<number>(10);
  const [uninstallAccess, setUninstallAccess] = useState<{ schoolId: string; code: string; expiresAt: number; createdAt?: number; createdBy?: string } | null>(
    null
  );
  const [schoolForm, setSchoolForm] = useState({
    schoolId: "",
    name: "",
    district: "",
    npsn: "",
    authEmail: "",
    adminEmail: "",
    backupEmail: "",
    isActive: true,
  });

  const callEduLockSuperApi = async (
    method: "POST" | "PUT" | "DELETE",
    payload: Record<string, any>
  ) => {
    const currentUser = edulockAuth.currentUser;
    if (!currentUser) {
      throw new Error("Sesi EduLock tidak aktif. Silakan login ulang.");
    }

    const idToken = await currentUser.getIdToken();
    const response = await fetch("/api/admin/edulock/super", {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success === false) {
      throw new Error(String(result?.message || "Permintaan super admin EduLock gagal diproses."));
    }

    return result;
  };

  const callEduLockAuthApi = async (payload: Record<string, any>) => {
    const response = await fetch("/api/admin/edulock/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success === false) {
      throw new Error(String(result?.message || "Permintaan auth EduLock gagal diproses."));
    }

    return result;
  };

  useEffect(() => {
    if (role && role !== "super_admin") router.replace("/edulock/admin");
  }, [role, router]);

  useEffect(() => {
    if (role !== "super_admin") return;

    const unsubAdmins = onValue(ref(edulockDb, "admin_profiles"), (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data !== "object") {
        setRuntimeAdmins([]);
        return;
      }
      const list: RuntimeAdminRow[] = Object.entries(data).map(([key, v]: any) => ({
        uid: String(v?.uid || key),
        email: String(v?.email || ""),
        role: String(v?.role || "admin") === "super_admin" ? "super_admin" : "admin",
        isActive: v?.isActive !== false,
        schoolId: v?.schoolId ? String(v.schoolId) : "",
        schoolName: v?.schoolName ? String(v.schoolName) : "",
        lastLoginAt: typeof v?.lastLoginAt === "number" ? v.lastLoginAt : null,
        mustChangePassword: v?.mustChangePassword === true,
      }));
      list.sort((a: any, b: any) => (Number(b.lastLoginAt || 0) || 0) - (Number(a.lastLoginAt || 0) || 0));
      setRuntimeAdmins(list);
    });

    const unsubSchools = onValue(ref(edulockDb, "schools"), (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data !== "object") {
        setSchools([]);
        return;
      }
      const list: SchoolRow[] = Object.entries(data).map(([key, v]: any) => ({
        schoolId: String(v?.schoolId || key),
        name: v?.name ? String(v.name) : "",
        district: v?.district ? String(v.district) : "",
        npsn: v?.npsn ? String(v.npsn) : "",
        authEmail: v?.authEmail ? String(v.authEmail) : "",
        adminEmail: v?.adminEmail ? String(v.adminEmail) : "",
        backupEmail: v?.backupEmail ? String(v.backupEmail) : "",
        isActive: v?.isActive !== false,
        adminAccessActive: v?.adminAccessActive !== false,
        updatedAt: typeof v?.updatedAt === "number" ? v.updatedAt : null,
        createdAt: typeof v?.createdAt === "number" ? v.createdAt : null,
      }));
      list.sort((a: any, b: any) => String(a.name || a.schoolId).localeCompare(String(b.name || b.schoolId)));
      setSchools(list);
    });

    const unsubLogs = onValue(ref(edulockDb, "violations"), (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data !== "object") {
        setLogs([]);
        return;
      }
      const list = Object.entries(data).map(([key, v]: any) => ({
        id: String(key),
        nisn: v?.nisn ? String(v.nisn) : "",
        type: v?.type ? String(v.type) : "",
        description: v?.description ? String(v.description) : "",
        timestamp: typeof v?.timestamp === "number" ? v.timestamp : null,
      }));
      list.sort((a: any, b: any) => (Number(b.timestamp || 0) || 0) - (Number(a.timestamp || 0) || 0));
      setLogs(list.slice(0, 200));
    });

    const unsubSessions = onValue(ref(edulockDb, "active_sessions"), (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data !== "object") {
        setSessions([]);
        return;
      }
      const list = Object.entries(data).map(([key, v]: any) => ({
        nisn: String(key),
        ...(v || {}),
      }));
      list.sort(
        (a: any, b: any) =>
          (Number(b?.updatedAt || b?.lastUpdated || b?.lastSeen || 0) || 0) - (Number(a?.updatedAt || a?.lastUpdated || a?.lastSeen || 0) || 0)
      );
      setSessions(list);
    });

    const unsubConfig = onValue(ref(edulockDb, "system_config/adminApiBaseUrl"), (snapshot) => {
      const value = snapshot.exists() ? String(snapshot.val() || "") : "";
      const url = value.trim();
      setAdminApiConfigUrl(url);
      setAdminApiInput((prev) => (String(prev || "").trim() ? prev : url));
    });

    return () => {
      unsubAdmins();
      unsubSchools();
      unsubLogs();
      unsubSessions();
      unsubConfig();
    };
  }, [role]);

  useEffect(() => {
    if (role !== "super_admin") return;

    const sid = normalize(monitoringSchoolId).toLowerCase();
    if (!sid) {
      setPresenceByNisn({});
      return;
    }
    const unsub = onValue(ref(edulockDb, `presence/${sid}`), (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data !== "object") {
        setPresenceByNisn({});
        return;
      }
      const map: Record<string, any> = {};
      for (const [nisn, v] of Object.entries(data)) map[String(nisn)] = v || {};
      setPresenceByNisn(map);
    });
    return () => unsub();
  }, [monitoringSchoolId, role]);

  useEffect(() => {
    if (role !== "super_admin") return;

    const sid = normalize(uninstallSchoolId).toLowerCase();
    if (!sid) {
      setUninstallAccess(null);
      return;
    }
    const unsub = onValue(ref(edulockDb, `schools/${sid}/uninstallAccess`), (snapshot) => {
      if (!snapshot.exists()) {
        setUninstallAccess(null);
        return;
      }
      const v = snapshot.val() || {};
      const code = v?.code ? String(v.code) : "";
      const expiresAt = typeof v?.expiresAt === "number" ? v.expiresAt : Number(v?.expiresAt || 0);
      const createdAt = typeof v?.createdAt === "number" ? v.createdAt : Number(v?.createdAt || 0) || undefined;
      const createdBy = v?.createdBy ? String(v.createdBy) : undefined;
      if (!code || !expiresAt) {
        setUninstallAccess(null);
        return;
      }
      setUninstallAccess({ schoolId: sid, code, expiresAt, createdAt, createdBy });
    });
    return () => unsub();
  }, [role, uninstallSchoolId]);

  const latestRuntimeAdminBySchoolId = useMemo(() => {
    const map = new Map<string, RuntimeAdminRow>();
    for (const admin of runtimeAdmins) {
      if (admin.role !== "admin") continue;
      const sid = normalize(admin.schoolId).toLowerCase();
      if (!sid) continue;
      const existing = map.get(sid);
      const currentTs = Number(admin.lastLoginAt || 0) || 0;
      const previousTs = Number(existing?.lastLoginAt || 0) || 0;
      if (!existing || currentTs >= previousTs) {
        map.set(sid, admin);
      }
    }
    return map;
  }, [runtimeAdmins]);

  const latestRuntimeAdminByEmail = useMemo(() => {
    const map = new Map<string, RuntimeAdminRow>();
    for (const admin of runtimeAdmins) {
      if (admin.role !== "admin") continue;
      const email = normalize(admin.email).toLowerCase();
      if (!email) continue;
      const existing = map.get(email);
      const currentTs = Number(admin.lastLoginAt || 0) || 0;
      const previousTs = Number(existing?.lastLoginAt || 0) || 0;
      if (!existing || currentTs >= previousTs) {
        map.set(email, admin);
      }
    }
    return map;
  }, [runtimeAdmins]);

  const latestRuntimeAdminByNpsn = useMemo(() => {
    const map = new Map<string, RuntimeAdminRow>();
    for (const admin of runtimeAdmins) {
      if (admin.role !== "admin") continue;
      const npsnValue = normalize((admin as any).npsn).toLowerCase();
      if (!npsnValue) continue;
      const existing = map.get(npsnValue);
      const currentTs = Number(admin.lastLoginAt || 0) || 0;
      const previousTs = Number(existing?.lastLoginAt || 0) || 0;
      if (!existing || currentTs >= previousTs) {
        map.set(npsnValue, admin);
      }
    }
    return map;
  }, [runtimeAdmins]);

  const schoolAdminRows = useMemo<SchoolAdminAccessRow[]>(() => {
    return schools.map((school) => {
      const loginIdentifier = getSchoolAdminLoginIdentifier(school);
      const systemEmail = getSchoolAdminSystemEmail(school.npsn);
      const runtime =
        latestRuntimeAdminBySchoolId.get(normalize(school.schoolId).toLowerCase()) ||
        latestRuntimeAdminByEmail.get(normalize(systemEmail).toLowerCase()) ||
        latestRuntimeAdminByNpsn.get(normalize(school.npsn).toLowerCase());
      return {
        schoolId: school.schoolId,
        schoolName: school.name,
        npsn: school.npsn,
        loginIdentifier,
        resetEmail: getSchoolAdminResetEmail(school),
        schoolActive: school.isActive,
        accessActive: school.adminAccessActive !== false,
        runtimeUid: String(runtime?.uid || ""),
        runtimeEmail: String(runtime?.email || ""),
        runtimeLastLoginAt: runtime?.lastLoginAt ?? null,
        runtimeMustChangePassword: runtime?.mustChangePassword === true,
      };
    });
  }, [latestRuntimeAdminByEmail, latestRuntimeAdminByNpsn, latestRuntimeAdminBySchoolId, schools]);

  const stats = useMemo(() => {
    const tenantsTotal = schools.length;
    const tenantsEnabled = schools.filter((school) => school.isActive).length;
    const tenantsLive = schoolAdminRows.filter((row) => hasOperationalRuntime(row)).length;
    const adminReady = schoolAdminRows.filter((row) => schoolHasAdminLoginConfig({ npsn: row.npsn, authEmail: row.loginIdentifier, adminEmail: "" })).length;
    const adminOpen = schoolAdminRows.filter((row) => row.schoolActive && row.accessActive).length;
    return { tenantsTotal, tenantsEnabled, tenantsLive, adminReady, adminOpen };
  }, [schoolAdminRows, schools]);

  useEffect(() => {
    const requestedSection = String(searchParams?.get("section") || "").trim();
    if (!isSuperSection(requestedSection)) return;
    if (requestedSection === activeSection) return;
    setActiveSection(requestedSection);
  }, [activeSection, searchParams]);

  const handleSelectSection = (nextSection: Section) => {
    setActiveSection(nextSection);
    router.replace(`/edulock/super?section=${nextSection}`, { scroll: false });
  };

  const filteredSessions = useMemo(() => {
    const sid = normalize(monitoringSchoolId).toLowerCase();
    if (!sid) return sessions;
    return sessions.filter((s: any) => normalize(s.schoolId).toLowerCase() === sid);
  }, [monitoringSchoolId, sessions]);

  const showStatus = (type: "success" | "error", text: string) => {
    setStatus({ type, text });
    setTimeout(() => setStatus({ type: "", text: "" }), 2500);
  };

  const toggleSchoolAdminAccess = async (row: SchoolAdminAccessRow, nextActive: boolean) => {
    const schoolId = normalize(row.schoolId);
    if (!schoolId) return;
    setSaving(true);
    try {
      await callEduLockSuperApi("PUT", {
        action: "toggle-school-admin-access",
        schoolId,
        nextActive,
      });
      showStatus("success", "Akses login admin sekolah diperbarui.");
    } catch (e: any) {
      showStatus("error", `Gagal update akses admin sekolah: ${String(e?.message || e)}`);
    } finally {
      setSaving(false);
    }
  };

  const resetSchoolAdminDefaultPassword = async (row: SchoolAdminAccessRow) => {
    const schoolId = normalize(row.schoolId).toLowerCase();
    if (!schoolId) {
      showStatus("error", "School ID tidak valid untuk reset password admin.");
      return;
    }
    setSaving(true);
    try {
      await callSuperApi("PUT", {
        action: "reset-school-admin-default-password",
        schoolId,
      });
      showStatus("success", `Reset Default berhasil untuk admin sekolah ${row.npsn || row.schoolId}. Username kembali ke NPSN dan password ke admin123.`);
    } catch (err: any) {
      showStatus("error", `Gagal menjalankan Reset Default: ${String(err?.message || err)}`);
    } finally {
      setSaving(false);
    }
  };

  const saveAdminApiUrl = async () => {
    const url = normalize(adminApiInput);
    setSaving(true);
    try {
      await callEduLockSuperApi("POST", {
        action: "save-admin-api-url",
        adminApiBaseUrl: url,
      });
      showStatus("success", "Admin API Base URL tersimpan.");
    } catch (e: any) {
      showStatus("error", `Gagal menyimpan: ${String(e?.message || e)}`);
    } finally {
      setSaving(false);
    }
  };

  const saveSchool = async () => {
    const schoolId = normalize(schoolForm.schoolId).toLowerCase();
    if (!schoolId) {
      showStatus("error", "School ID wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      await callEduLockSuperApi("POST", {
        action: "save-school",
        school: {
          schoolId,
          name: normalize(schoolForm.name),
          district: normalize(schoolForm.district),
          npsn: normalize(schoolForm.npsn),
          authEmail: normalize(schoolForm.authEmail).toLowerCase(),
          adminEmail: normalize(schoolForm.adminEmail).toLowerCase(),
          backupEmail: normalize(schoolForm.backupEmail).toLowerCase(),
          isActive: schoolForm.isActive !== false,
        },
      });

      showStatus("success", "Sekolah tersimpan.");
      setSchoolForm({
        schoolId: "",
        name: "",
        district: "",
        npsn: "",
        authEmail: "",
        adminEmail: "",
        backupEmail: profile?.email || "",
        isActive: true,
      });
    } catch (e: any) {
      showStatus("error", `Gagal simpan sekolah: ${String(e?.message || e)}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleSchoolActive = async (schoolId: string, nextActive: boolean) => {
    setSaving(true);
    try {
      await callEduLockSuperApi("PUT", {
        action: "toggle-school-active",
        schoolId,
        nextActive,
      });
      showStatus("success", "Status sekolah diperbarui.");
    } catch (e: any) {
      showStatus("error", `Gagal update sekolah: ${String(e?.message || e)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateUninstallCode = async () => {
    const sid = normalize(uninstallSchoolId).toLowerCase();
    if (!sid) {
      showStatus("error", "Pilih sekolah terlebih dahulu.");
      return;
    }
    const minutes = Number(uninstallDurationMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      showStatus("error", "Durasi harus > 0 menit.");
      return;
    }

    setSaving(true);
    try {
      await callEduLockSuperApi("POST", {
        action: "generate-uninstall-code",
        schoolId: sid,
        uninstallDurationMinutes: minutes,
      });
      showStatus("success", `Kode uninstall dibuat untuk ${sid}.`);
    } catch (e: any) {
      showStatus("error", `Gagal membuat kode: ${String(e?.message || e)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeUninstallCode = async () => {
    const sid = normalize(uninstallSchoolId).toLowerCase();
    if (!sid) {
      showStatus("error", "Pilih sekolah terlebih dahulu.");
      return;
    }
    if (!window.confirm("Hapus kode uninstall aktif untuk sekolah ini?")) return;

    setSaving(true);
    try {
      await callEduLockSuperApi("DELETE", {
        action: "revoke-uninstall-code",
        schoolId: sid,
      });
      showStatus("success", "Kode uninstall dihapus.");
    } catch (e: any) {
      showStatus("error", `Gagal menghapus kode: ${String(e?.message || e)}`);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !role) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-6 py-4 text-sm text-slate-200">
          Memverifikasi akses EduLock Super Admin...
        </div>
      </div>
    );
  }

  if (role !== "super_admin") {
    return null;
  }

  return (
    <EduLockWorkspaceShell
      title="Super Admin EduLock"
      subtitle="Control plane lintas sekolah untuk tenant, policy keamanan, command center, audit, dan support yang kini menyatu dengan shell PortalKita."
      badge="MODE SUPER ADMIN"
      panelTitle="EduLock Control Plane"
      panelDescription="Struktur submenu disejajarkan dengan admin sekolah: overview, operasional, keamanan, lalu konfigurasi."
      navGroups={SUPER_NAV_GROUPS}
      activeKey={activeSection}
      onSelect={(key) => handleSelectSection(key as Section)}
      actions={
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold tracking-widest text-slate-400">RUANG KERJA</div>
              <div className="mt-2 text-lg font-bold text-white">
                {SUPER_NAV_GROUPS.flatMap((group) => group.items).find((item) => item.key === activeSection)?.label || "EduLock"}
              </div>
              <div className="mt-1 text-sm text-slate-300">Login aktif: {profile?.email || "-"}</div>
            </div>
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100">
              Semua tenant dan akses admin dikendalikan dari satu panel
            </div>
          </div>
        </div>
      }
    >

            {status.type && (
              <div
                className={`rounded-2xl border p-4 text-sm ${
                  status.type === "success"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                    : "border-red-500/20 bg-red-500/10 text-red-100"
                }`}
              >
                {status.text}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-xl backdrop-blur">
                <div className="text-xs font-semibold tracking-widest text-slate-400">TOTAL TENANT</div>
                <div className="mt-1 text-2xl font-bold text-white">{stats.tenantsTotal}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-xl backdrop-blur">
                <div className="text-xs font-semibold tracking-widest text-slate-400">TENANT DIBUKA</div>
                <div className="mt-1 text-2xl font-bold text-white">{stats.tenantsEnabled}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-xl backdrop-blur">
                <div className="text-xs font-semibold tracking-widest text-slate-400">TENANT LIVE</div>
                <div className="mt-1 text-2xl font-bold text-white">{stats.tenantsLive}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-xl backdrop-blur">
                <div className="text-xs font-semibold tracking-widest text-slate-400">LOGIN DIBUKA</div>
                <div className="mt-1 text-2xl font-bold text-white">{stats.adminOpen}</div>
              </div>
            </div>

            {activeSection === "dashboard" && (
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
                <div className="text-sm font-semibold text-slate-100">Dashboard</div>
                <div className="mt-1 text-sm text-slate-300">
                  Ringkasan: tenants, admin aktif, session aktif, serta audit terbaru. Menu lain disiapkan bertahap sesuai arsitektur.
                </div>
              </div>
            )}

            {activeSection === "admins" && (
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl backdrop-blur overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10">
                  <div className="text-sm font-semibold text-slate-100">Admin Sekolah ({schoolAdminRows.length})</div>
                  <div className="mt-1 text-xs text-slate-400">
                    Super admin mengontrol login admin sekolah dari tenant registry. `admin_profiles` hanya dipakai sebagai runtime profile saat admin sudah login.
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-white/10 text-sm">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">LOGIN ADMIN</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">SEKOLAH</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">LOGIN TERAKHIR</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">STATUS</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold tracking-widest text-slate-300">AKSI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {schoolAdminRows.map((a) => (
                        <tr key={a.schoolId} className="hover:bg-white/5">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white">{a.loginIdentifier || "-"}</div>
                            <div className="text-xs text-slate-400">
                              {a.npsn ? "Password default: admin123" : "Lengkapi NPSN sekolah"}
                            </div>
                            {a.runtimeEmail && a.runtimeEmail !== a.loginIdentifier && (
                              <div className="text-xs text-slate-500">Runtime: {a.runtimeEmail}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-slate-200">{a.schoolName || "-"}</div>
                            <div className="text-xs text-slate-400">{a.schoolId || ""}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-200">{formatTs(a.runtimeLastLoginAt)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                a.schoolActive && a.accessActive
                                  ? "bg-emerald-500/10 text-emerald-100 ring-1 ring-inset ring-emerald-400/20"
                                  : "bg-red-500/10 text-red-100 ring-1 ring-inset ring-red-400/20"
                              }`}
                            >
                              {a.schoolActive && a.accessActive ? "Login Dibuka" : "Login Ditutup"}
                            </span>
                            {!a.schoolActive && (
                              <span className="ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-700/80 text-slate-100 ring-1 ring-inset ring-slate-500/30">
                                Tenant Ditutup
                              </span>
                            )}
                            {hasOperationalRuntime(a) ? (
                              <span className="ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-cyan-500/10 text-cyan-100 ring-1 ring-inset ring-cyan-400/20">
                                Live
                              </span>
                            ) : (
                              <span className="ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-700/80 text-slate-100 ring-1 ring-inset ring-slate-500/30">
                                Belum Live
                              </span>
                            )}
                            {a.runtimeMustChangePassword && (
                              <span className="ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-yellow-500/10 text-yellow-100 ring-1 ring-inset ring-yellow-400/20">
                                Wajib ganti
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => toggleSchoolAdminAccess(a, !a.accessActive)}
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                            >
                              {a.accessActive ? "Tutup Login" : "Buka Login"}
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => resetSchoolAdminDefaultPassword(a)}
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                            >
                              Reset Default
                            </button>
                          </td>
                        </tr>
                      ))}
                      {schoolAdminRows.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                            Belum ada data admin sekolah.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeSection === "tenants" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl backdrop-blur">
                  <div className="text-sm font-semibold text-slate-100">Tambah / Update Sekolah</div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold tracking-widest text-slate-400">SCHOOL ID</label>
                      <input
                        value={schoolForm.schoolId}
                        onChange={(e) => setSchoolForm((s) => ({ ...s, schoolId: e.target.value }))}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                        placeholder="contoh: smpn_3_pacet"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold tracking-widest text-slate-400">NAMA</label>
                      <input
                        value={schoolForm.name}
                        onChange={(e) => setSchoolForm((s) => ({ ...s, name: e.target.value }))}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                        placeholder="SMPN 3 PACET"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold tracking-widest text-slate-400">KECAMATAN</label>
                      <input
                        value={schoolForm.district}
                        onChange={(e) => setSchoolForm((s) => ({ ...s, district: e.target.value }))}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                        placeholder="Pacet"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold tracking-widest text-slate-400">NPSN</label>
                      <input
                        value={schoolForm.npsn}
                        onChange={(e) => setSchoolForm((s) => ({ ...s, npsn: e.target.value }))}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                        placeholder="20555784"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold tracking-widest text-slate-400">EMAIL KONTAK LOGIN</label>
                      <input
                        value={schoolForm.authEmail}
                        onChange={(e) => setSchoolForm((s) => ({ ...s, authEmail: e.target.value }))}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                        placeholder="email kontak login sekolah"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold tracking-widest text-slate-400">EMAIL KONTAK ADMIN</label>
                      <input
                        value={schoolForm.adminEmail}
                        onChange={(e) => setSchoolForm((s) => ({ ...s, adminEmail: e.target.value }))}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                        placeholder="admin@sekolah.id"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold tracking-widest text-slate-400">EMAIL BACKUP</label>
                      <input
                        value={schoolForm.backupEmail}
                        onChange={(e) => setSchoolForm((s) => ({ ...s, backupEmail: e.target.value }))}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                        placeholder={profile?.email || "email backup"}
                      />
                    </div>
                    <div className="flex items-center gap-2 sm:mt-7">
                      <input
                        id="schoolActive"
                        type="checkbox"
                        checked={schoolForm.isActive}
                        onChange={(e) => setSchoolForm((s) => ({ ...s, isActive: e.target.checked }))}
                      />
                      <label htmlFor="schoolActive" className="text-sm text-slate-200">
                        Tenant dibuka
                      </label>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={saveSchool}
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      Simpan Sekolah
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl backdrop-blur overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/10">
                    <div className="text-sm font-semibold text-slate-100">Daftar Sekolah ({schools.length})</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-white/10 text-sm">
                      <thead className="bg-white/5">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">SEKOLAH</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">NPSN</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">EMAIL</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">STATUS</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold tracking-widest text-slate-300">AKSI</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {schools.map((s) => (
                          <tr key={s.schoolId} className="hover:bg-white/5">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-white">{s.name || "-"}</div>
                              <div className="text-xs text-slate-400">
                                {s.schoolId} {s.district ? `• ${s.district}` : ""}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-200">{s.npsn || "-"}</td>
                            <td className="px-4 py-3">
                              <div className="text-slate-200">{s.adminEmail || "-"}</div>
                              <div className="text-xs text-slate-400">{s.authEmail || ""}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-700/80 text-slate-100 ring-1 ring-inset ring-slate-500/30">
                                Terdaftar
                              </span>
                              <span
                                className={`ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  s.isActive
                                    ? "bg-cyan-500/10 text-cyan-100 ring-1 ring-inset ring-cyan-400/20"
                                    : "bg-amber-500/10 text-amber-100 ring-1 ring-inset ring-amber-400/20"
                                }`}
                              >
                                {s.isActive ? "Tenant Dibuka" : "Tenant Ditutup"}
                              </span>
                              <span
                                className={`ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  s.adminAccessActive !== false
                                    ? "bg-cyan-500/10 text-cyan-100 ring-1 ring-inset ring-cyan-400/20"
                                    : "bg-amber-500/10 text-amber-100 ring-1 ring-inset ring-amber-400/20"
                                }`}
                              >
                                {s.adminAccessActive !== false ? "Login Dibuka" : "Login Ditutup"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right space-x-2">
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() =>
                                  setSchoolForm({
                                    schoolId: s.schoolId || "",
                                    name: s.name || "",
                                    district: s.district || "",
                                    npsn: s.npsn || "",
                                    authEmail: s.authEmail || "",
                                    adminEmail: s.adminEmail || "",
                                    backupEmail: s.backupEmail || "",
                                    isActive: s.isActive !== false,
                                  })
                                }
                                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => toggleSchoolActive(String(s.schoolId), !s.isActive)}
                                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                              >
                                {s.isActive ? "Tutup Tenant" : "Buka Tenant"}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {schools.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                              Belum ada data sekolah.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "monitoring" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl backdrop-blur">
                  <div className="text-sm font-semibold text-slate-100">Filter Monitoring</div>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold tracking-widest text-slate-400">SCHOOL ID</label>
                      <select
                        value={monitoringSchoolId}
                        onChange={(e) => setMonitoringSchoolId(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
                      >
                        <option value="">Semua Sekolah</option>
                        {schools.map((s: any) => (
                          <option key={s.schoolId} value={s.schoolId}>
                            {s.name || s.schoolId}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="text-sm text-slate-300">
                      Session aktif: <span className="font-semibold text-white">{filteredSessions.length}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl backdrop-blur overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/10">
                    <div className="text-sm font-semibold text-slate-100">Active Sessions</div>
                    <div className="text-xs text-slate-400">Data dari node active_sessions dan presence/{`{schoolId}`}.</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-white/10 text-sm">
                      <thead className="bg-white/5">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">NISN</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">SEKOLAH</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">STATUS</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">TERAKHIR UPDATE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {filteredSessions.map((s: any) => {
                          const ts = Number(s.updatedAt || s.lastUpdated || s.lastSeen || 0) || null;
                          const schoolId = normalize(s.schoolId);
                          const presence = schoolId ? presenceByNisn[String(s.nisn)] : null;
                          const inside = typeof presence?.isInsideZone === "boolean" ? presence.isInsideZone : s.isInsideZone;
                          const inet = typeof presence?.isInternetActive === "boolean" ? presence.isInternetActive : s.isInternetActive;
                          return (
                            <tr key={String(s.nisn)} className="hover:bg-white/5">
                              <td className="px-4 py-3 font-semibold text-white">{String(s.nisn || "-")}</td>
                              <td className="px-4 py-3">
                                <div className="text-slate-200">{normalize(s.schoolName) || "-"}</div>
                                <div className="text-xs text-slate-400">{schoolId || "-"}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-slate-200">
                                  {inside === true ? "Di Zona" : inside === false ? "Di Luar" : "-"} •{" "}
                                  {inet === true ? "Internet ON" : inet === false ? "Internet OFF" : "-"}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-200">{formatTs(ts)}</td>
                            </tr>
                          );
                        })}
                        {filteredSessions.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                              Tidak ada session aktif.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "audit" && (
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl backdrop-blur overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10">
                  <div className="text-sm font-semibold text-slate-100">Audit Log (Violations) - 200 terbaru</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-white/10 text-sm">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">WAKTU</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">NISN</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">TIPE</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">DESKRIPSI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {logs.map((l: any) => (
                        <tr key={l.id} className="hover:bg-white/5">
                          <td className="px-4 py-3 text-slate-200">{formatTs(l.timestamp)}</td>
                          <td className="px-4 py-3 font-semibold text-white">{l.nisn || "-"}</td>
                          <td className="px-4 py-3 text-slate-200">{l.type || "-"}</td>
                          <td className="px-4 py-3 text-slate-200">{l.description || "-"}</td>
                        </tr>
                      ))}
                      {logs.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                            Belum ada audit log.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeSection === "settings" && (
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl backdrop-blur">
                <div className="text-sm font-semibold text-slate-100">System Settings</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold tracking-widest text-slate-400">ADMIN API BASE URL</label>
                    <input
                      value={adminApiInput}
                      onChange={(e) => setAdminApiInput(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                      placeholder="https://...."
                    />
                    <div className="mt-2 text-xs text-slate-400">Tersimpan: {adminApiConfigUrl || "-"}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={saveAdminApiUrl}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            )}

            {activeSection === "command_center" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl backdrop-blur">
                  <div className="text-sm font-semibold text-slate-100">Kode Uninstall (Sekolah)</div>
                  <div className="mt-1 text-sm text-slate-300">
                    Buat kode uninstall sementara untuk sekolah tertentu. Kode ini akan ditampilkan di dashboard Admin Sekolah pada menu Pengaturan Sistem.
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold tracking-widest text-slate-400">SEKOLAH</label>
                      <select
                        value={uninstallSchoolId}
                        onChange={(e) => setUninstallSchoolId(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
                      >
                        <option value="">Pilih sekolah</option>
                        {schools.map((s: any) => (
                          <option key={s.schoolId} value={s.schoolId}>
                            {s.name || s.schoolId}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold tracking-widest text-slate-400">DURASI (MENIT)</label>
                      <input
                        type="number"
                        min={1}
                        value={String(uninstallDurationMinutes)}
                        onChange={(e) => setUninstallDurationMinutes(Number(e.target.value || 0))}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleGenerateUninstallCode}
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      Buat Kode
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleRevokeUninstallCode}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                    >
                      Hapus Kode
                    </button>
                  </div>

                  <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold tracking-widest text-slate-400">KODE AKTIF</div>
                    {uninstallAccess && uninstallAccess.expiresAt > Date.now() ? (
                      <div className="mt-2 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
                        <div>
                          <div className="text-2xl font-bold tracking-widest text-white">{uninstallAccess.code}</div>
                          <div className="mt-1 text-xs text-slate-300">Berlaku sampai {formatTs(uninstallAccess.expiresAt)}</div>
                          {uninstallAccess.createdBy ? (
                            <div className="mt-1 text-xs text-slate-400">Dibuat oleh: {uninstallAccess.createdBy}</div>
                          ) : null}
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(uninstallAccess.code);
                                  showStatus("success", "Kode disalin.");
                                } catch {
                                  showStatus("error", "Gagal menyalin kode.");
                                }
                              }}
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                        <div className="inline-flex items-center justify-center rounded-2xl bg-white p-3">
                          <QRCode value={uninstallAccess.code} size={132} />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-slate-400 italic">Belum ada kode aktif atau sudah kedaluwarsa.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeSection !== "dashboard" &&
              activeSection !== "admins" &&
              activeSection !== "tenants" &&
              activeSection !== "monitoring" &&
              activeSection !== "audit" &&
              activeSection !== "command_center" &&
              activeSection !== "settings" && (
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
                  <div className="text-sm font-semibold text-slate-100">Dalam Pengembangan</div>
                  <div className="mt-1 text-sm text-slate-300">Menu ini disiapkan sesuai arsitektur Super Admin.</div>
                </div>
              )}
    </EduLockWorkspaceShell>
  );
}

export default function EduLockSuperAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-6 py-4 text-sm text-slate-200">
            Menyiapkan panel EduLock Super Admin...
          </div>
        </div>
      }
    >
      <EduLockSuperAdminPageInner />
    </Suspense>
  );
}
