"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { equalTo, onValue, orderByChild, query as dbQuery, ref } from "firebase/database";
import { database } from "@/lib/firebase";
import { edulockAuth, edulockDb } from "@/lib/edulockFirebase";
import { useEduLockAuth } from "@/lib/useEduLockAuth";
import { useAuthStore } from "@/store/useAuthStore";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  Trash2,
  Users,
} from "lucide-react";

type StudentRow = {
  nisn: string;
  name: string;
  gender?: "L" | "P" | "";
  religion?: "ISLAM" | "NON_ISLAM" | "";
  class: string;
  status?: "Aktif" | "Nonaktif" | "";
  device?: string;
  schoolId?: string;
  schoolName?: string;
  npsn?: string;
  createdAt?: number;
  updatedAt?: number;
};

type ActiveSessionRow = {
  nisn: string;
  isOnline?: boolean;
  deviceStatus?: string;
  lastUpdated?: number;
  updatedAt?: number;
  lastSeen?: number;
};

type TeacherRow = {
  nuptk: string;
  name: string;
  class: string;
  status?: "Aktif" | "Nonaktif" | "";
  deviceId?: string;
  schoolId?: string;
  schoolName?: string;
  npsn?: string;
  createdAt?: number;
  updatedAt?: number;
};

type StaffRow = {
  nisn: string;
  position?: string;
  status?: "Aktif" | "Nonaktif" | "";
  role?: "osis" | "";
  schoolId?: string;
  schoolName?: string;
  npsn?: string;
  createdAt?: number;
  updatedAt?: number;
};

type TatibRow = {
  username: string;
  name: string;
  password?: string;
  role?: string;
  isActive?: boolean;
  deviceId?: string;
  schoolId?: string;
  schoolName?: string;
  npsn?: string;
  createdAt?: number;
  updatedAt?: number;
};

type ClassRow = {
  className: string;
  grade: 7 | 8 | 9;
  disabled?: boolean;
  schoolId?: string;
  schoolName?: string;
  npsn?: string;
  createdAt?: number;
  updatedAt?: number;
};

type StudentMutationApiPayload = {
  nisn?: string;
  previousNisn?: string;
  previousClassName?: string;
  name?: string;
  gender?: "L" | "P" | "";
  religion?: "ISLAM" | "NON_ISLAM" | "";
  className?: string;
  status?: "Aktif" | "Nonaktif" | "";
  schoolId?: string;
  schoolName?: string;
  npsn?: string;
  grade?: 7 | 8 | 9;
  action?: "reset-device" | "class-create" | "class-update" | "class-delete";
};

type PersonnelMutationApiPayload = {
  entity: "teacher" | "staff" | "tatib";
  action?: "reset-device";
  nuptk?: string;
  nisn?: string;
  username?: string;
  name?: string;
  password?: string;
  className?: string;
  position?: string;
  status?: "Aktif" | "Nonaktif" | "";
  isActive?: boolean;
  schoolId?: string;
  schoolName?: string;
  npsn?: string;
};

type PrincipalMutationApiPayload = {
  action?: "toggle-active" | "reset-device" | "bulk-reset-passwords";
  username?: string;
  name?: string;
  schoolId?: string;
  schoolName?: string;
  password?: string;
  isActive?: boolean;
};

type SuperDbSection = "schools" | "admins" | "principals" | "monitoring";

type SuperPrincipalRow = {
  username: string;
  name: string;
  schoolId: string;
  schoolName: string;
  isActive: boolean;
  deviceId?: string | null;
  credentialHash?: string | null;
  lastLoginAt?: number | null;
  createdAt?: number | null;
  updatedAt?: number | null;
};

type SuperSchoolRow = {
  schoolId: string;
  name: string;
  district: string;
  npsn: string;
  authEmail: string;
  adminEmail: string;
  backupEmail: string;
  isActive: boolean;
  adminAccessActive: boolean;
  createdAt?: number | null;
  updatedAt?: number | null;
};

type SuperAdminProfileRow = {
  uid: string;
  email: string;
  role: "super_admin" | "admin";
  isActive: boolean;
  schoolId: string;
  schoolName: string;
  npsn?: string;
  lastLoginAt?: number | null;
  mustChangePassword?: boolean;
  passwordChangedAt?: number | null;
};

type SuperViolationRow = {
  id: string;
  nisn: string;
  type: string;
  description: string;
  timestamp: number | null;
};

const SUPER_ADMIN_DATABASE_MENU = [
  ["schools", "Sekolah & Tenant"],
  ["admins", "Admin Sekolah"],
  ["principals", "Akun Kepala Sekolah"],
  ["monitoring", "Monitoring Akun & Layanan"],
] as const;

type SuperSchoolAdminRow = {
  schoolId: string;
  schoolName: string;
  npsn: string;
  schoolActive: boolean;
  accessActive: boolean;
  loginIdentifier: string;
  resetEmail: string;
  runtimeUid: string;
  runtimeEmail: string;
  runtimeLastLoginAt?: number | null;
  runtimeMustChangePassword: boolean;
  runtimeIsActive: boolean;
};

type SuperAdminSchoolForm = {
  schoolId: string;
  schoolName: string;
  npsn: string;
  authEmail: string;
  adminEmail: string;
  backupEmail: string;
  schoolActive: boolean;
  adminAccessActive: boolean;
};

function normalize(value: unknown): string {
  return String(value || "").trim();
}

function getSchoolAdminResetEmail(school: Pick<SuperSchoolRow, "authEmail" | "adminEmail">): string {
  const authEmail = normalize(school.authEmail).toLowerCase();
  const adminEmail = normalize(school.adminEmail).toLowerCase();
  if (authEmail.includes("@") && !authEmail.endsWith("@edulock.local")) return authEmail;
  if (adminEmail.includes("@") && !adminEmail.endsWith("@edulock.local")) return adminEmail;
  return "";
}

function getSchoolAdminLoginIdentifier(school: Pick<SuperSchoolRow, "npsn" | "authEmail" | "adminEmail">): string {
  const npsn = normalize(school.npsn);
  if (npsn) return npsn;
  return "";
}

function schoolHasAdminLoginConfig(school: Pick<SuperSchoolRow, "npsn" | "authEmail" | "adminEmail">): boolean {
  return Boolean(normalize(school.npsn));
}

function getSchoolAdminSystemEmail(npsn: unknown): string {
  const normalized = normalize(npsn);
  return normalized ? `${normalized}@edulock.local` : "";
}

function hasOperationalRuntime(row?: Pick<SuperSchoolAdminRow, "runtimeUid" | "runtimeLastLoginAt"> | null): boolean {
  if (!row) return false;
  if (normalize(row.runtimeUid)) return true;
  return Number(row.runtimeLastLoginAt || 0) > 0;
}

function formatDateTime(ts?: number): string {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString("id-ID");
  } catch {
    return "-";
  }
}

function toGradeFromClass(className: string): 7 | 8 | 9 | 0 {
  const v = normalize(className).toUpperCase();
  if (!v) return 0;
  if (v.startsWith("VIII")) return 8;
  if (v.startsWith("VII")) return 7;
  if (v.startsWith("IX")) return 9;
  return 0;
}

function romanFromGrade(grade: 7 | 8 | 9): "VII" | "VIII" | "IX" {
  if (grade === 7) return "VII";
  if (grade === 8) return "VIII";
  return "IX";
}

function buildClassName(raw: string, grade: 7 | 8 | 9): string {
  const v = normalize(raw).toUpperCase();
  if (!v) return "";
  const m = v.match(/^(VIII|VII|IX)[\s-]?(.*)$/);
  if (m) {
    const roman = m[1] as "VII" | "VIII" | "IX";
    const suffix = normalize(m[2]).replace(/^[\s-]+/, "");
    if (!suffix) return roman;
    return `${roman}-${suffix}`;
  }
  const suffix = v.replace(/^[\s-]+/, "");
  return `${romanFromGrade(grade)}-${suffix}`;
}

function compareClassNames(a: string, b: string): number {
  const parse = (raw: string): { grade: number; suffix: string } => {
    let v = normalize(raw).toUpperCase();
    v = v.replace(/^KELAS\s+/, "");
    v = v.replace(/^KLS\s+/, "");
    const m1 = v.match(/^(VIII|VII|IX)\s*[-._\s]?\s*(.*)$/);
    const m = m1 || v.match(/(VIII|VII|IX)\s*[-._\s]?\s*(.*)$/);
    if (m) {
      const roman = m[1];
      const grade = roman === "VII" ? 7 : roman === "VIII" ? 8 : roman === "IX" ? 9 : 0;
      const suffix = normalize(String(m[2] || "")).replace(/^[\s\-._]+/, "");
      return { grade: grade || 999, suffix };
    }
    const gradeRaw = toGradeFromClass(v);
    return { grade: gradeRaw || 999, suffix: "" };
  };

  const pa = parse(a);
  const pb = parse(b);
  if (pa.grade !== pb.grade) return pa.grade - pb.grade;
  if (!pa.suffix && pb.suffix) return -1;
  if (pa.suffix && !pb.suffix) return 1;
  return pa.suffix.localeCompare(pb.suffix, "id-ID", { numeric: true, sensitivity: "base" });
}

export default function MasterStudentsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950">
          <div className="pointer-events-none fixed inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(99,102,241,0.28),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(34,211,238,0.18),transparent_50%),radial-gradient(800px_circle_at_50%_85%,rgba(168,85,247,0.14),transparent_55%)]" />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-black" />
          </div>
          <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center p-6">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-6 py-4 text-sm font-semibold text-slate-200 shadow-xl backdrop-blur">
              Memuat halaman database...
            </div>
          </div>
        </div>
      }
    >
      <MasterStudentsContent />
    </Suspense>
  );
}

function MasterStudentsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, _hasHydrated } = useAuthStore();
  const { isLoading: isEduLockAuthLoading } = useEduLockAuth();
  const [mounted, setMounted] = useState(false);

  const [superSection, setSuperSection] = useState<SuperDbSection>("schools");
  const [superSchools, setSuperSchools] = useState<SuperSchoolRow[]>([]);
  const [superAdmins, setSuperAdmins] = useState<SuperAdminProfileRow[]>([]);
  const [superViolations, setSuperViolations] = useState<SuperViolationRow[]>([]);
  const [superPrincipals, setSuperPrincipals] = useState<SuperPrincipalRow[]>([]);
  const [superSaving, setSuperSaving] = useState(false);
  const [superSchoolForm, setSuperSchoolForm] = useState({
    schoolId: "",
    name: "",
    district: "",
    npsn: "",
    authEmail: "",
    adminEmail: "",
    backupEmail: "",
    isActive: true,
  });
  const [adminSchoolEditing, setAdminSchoolEditing] = useState("");
  const [adminSchoolForm, setAdminSchoolForm] = useState<SuperAdminSchoolForm>({
    schoolId: "",
    schoolName: "",
    npsn: "",
    authEmail: "",
    adminEmail: "",
    backupEmail: "",
    schoolActive: true,
    adminAccessActive: true,
  });

  const [studentRows, setStudentRows] = useState<StudentRow[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionRow[]>([]);
  const [teacherRows, setTeacherRows] = useState<TeacherRow[]>([]);
  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  const [tatibRows, setTatibRows] = useState<TatibRow[]>([]);
  const [classRows, setClassRows] = useState<ClassRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<{ type: "" | "success" | "error"; text: string }>({ type: "", text: "" });
  const [busy, setBusy] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number>(0);
  const [statusNow, setStatusNow] = useState<number>(() => Date.now());

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ nisn: "", name: "", gender: "L" as "L" | "P", religion: "ISLAM" as "ISLAM" | "NON_ISLAM", class: "" });
  const [editingNisn, setEditingNisn] = useState<string>("");
  const [editForm, setEditForm] = useState({ name: "", gender: "" as "" | "L" | "P", class: "", status: "Aktif" as "Aktif" | "Nonaktif" });

  const [teacherCreateOpen, setTeacherCreateOpen] = useState(false);
  const [teacherCreateForm, setTeacherCreateForm] = useState({ nuptk: "", name: "", class: "" });
  const [teacherEditOpen, setTeacherEditOpen] = useState(false);
  const [teacherEditingNuptk, setTeacherEditingNuptk] = useState<string>("");
  const [teacherEditForm, setTeacherEditForm] = useState({ name: "", class: "", status: "Aktif" as "Aktif" | "Nonaktif" });

  const [staffCreateOpen, setStaffCreateOpen] = useState(false);
  const [staffCreateForm, setStaffCreateForm] = useState({ nisn: "", position: "" });
  const [staffEditOpen, setStaffEditOpen] = useState(false);
  const [staffEditingNisn, setStaffEditingNisn] = useState<string>("");
  const [staffEditForm, setStaffEditForm] = useState({
    position: "",
    status: "Aktif" as "Aktif" | "Nonaktif",
  });

  const [tatibCreateOpen, setTatibCreateOpen] = useState(false);
  const [tatibCreateForm, setTatibCreateForm] = useState({ name: "", username: "", password: "", isActive: true });
  const [tatibEditOpen, setTatibEditOpen] = useState(false);
  const [tatibEditingUsername, setTatibEditingUsername] = useState<string>("");
  const [tatibEditForm, setTatibEditForm] = useState({ name: "", password: "", isActive: true });

  const [classCreateOpen, setClassCreateOpen] = useState(false);
  const [classCreateForm, setClassCreateForm] = useState({ className: "" });
  const [classEditOpen, setClassEditOpen] = useState(false);
  const [classEditingName, setClassEditingName] = useState("");
  const [classEditForm, setClassEditForm] = useState({ className: "" });

  const [selectedGrade, setSelectedGrade] = useState<7 | 8 | 9>(7);

  const [principalForm, setPrincipalForm] = useState({
    username: "",
    name: "",
    schoolId: "",
    schoolName: "",
    password: "",
    isActive: true,
  });
  const [principalEditing, setPrincipalEditing] = useState<string>("");
  const [principalQuery, setPrincipalQuery] = useState("");
  const [principalSaving, setPrincipalSaving] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>("");

  const callEduLockSuperApi = async (method: "POST" | "PUT" | "DELETE", payload: Record<string, any>) => {
    const currentUser = edulockAuth.currentUser;
    if (!currentUser) throw new Error("Sesi EduLock tidak aktif. Silakan login ulang.");
    const idToken = await currentUser.getIdToken();
    const response = await fetch("/api/admin/edulock/super", {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success === false) throw new Error(String(result?.message || "Permintaan backend super admin gagal diproses."));
    return result;
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !_hasHydrated) return;
    if (!isAuthenticated || (user?.role !== "admin" && user?.role !== "super_admin")) {
      router.replace("/admin/login?returnTo=/admin/students");
    }
  }, [isAuthenticated, mounted, router, user?.role, _hasHydrated]);

  useEffect(() => {
    if (!mounted || !_hasHydrated || isEduLockAuthLoading) return;
    if (!isAuthenticated || user?.role !== "super_admin") return;
    if (pathname !== "/admin/students") return;
    router.replace("/super-admin/database");
  }, [isAuthenticated, isEduLockAuthLoading, mounted, pathname, router, user?.role, _hasHydrated]);

  useEffect(() => {
    if (!mounted || !_hasHydrated) return;
    if (!isAuthenticated || user?.role !== "super_admin") return;

    const unsubSchools = onValue(ref(edulockDb, "schools"), (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data !== "object") {
        setSuperSchools([]);
        return;
      }
      const list: SuperSchoolRow[] = Object.entries(data).map(([key, v]: any) => ({
        schoolId: String(v?.schoolId || key),
        name: v?.name ? String(v.name) : "",
        district: v?.district ? String(v.district) : "",
        npsn: v?.npsn ? String(v.npsn) : "",
        authEmail: v?.authEmail ? String(v.authEmail) : "",
        adminEmail: v?.adminEmail ? String(v.adminEmail) : "",
        backupEmail: v?.backupEmail ? String(v.backupEmail) : "",
        isActive: v?.isActive !== false,
        adminAccessActive: v?.adminAccessActive !== false,
        createdAt: typeof v?.createdAt === "number" ? v.createdAt : null,
        updatedAt: typeof v?.updatedAt === "number" ? v.updatedAt : null,
      }));
      list.sort((a, b) => String(a.name || a.schoolId).localeCompare(String(b.name || b.schoolId)));
      setSuperSchools(list);
    }, (error) => {
      setSuperSchools([]);
    });

    const unsubAdmins = onValue(ref(edulockDb, "admin_profiles"), (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data !== "object") {
        setSuperAdmins([]);
        return;
      }
      const list: SuperAdminProfileRow[] = Object.entries(data).map(([key, v]: any) => ({
        uid: String(v?.uid || key),
        email: String(v?.email || ""),
        role: String(v?.role || "admin") === "super_admin" ? "super_admin" : "admin",
        isActive: v?.isActive !== false,
        schoolId: v?.schoolId ? String(v.schoolId) : "",
        schoolName: v?.schoolName ? String(v.schoolName) : "",
        npsn: v?.npsn ? String(v.npsn) : undefined,
        lastLoginAt: typeof v?.lastLoginAt === "number" ? v.lastLoginAt : null,
        mustChangePassword: v?.mustChangePassword === true,
        passwordChangedAt: typeof v?.passwordChangedAt === "number" ? v.passwordChangedAt : null,
      }));
      list.sort((a, b) => (Number(b.lastLoginAt || 0) || 0) - (Number(a.lastLoginAt || 0) || 0));
      setSuperAdmins(list);
    });

    const unsubViolations = onValue(ref(edulockDb, "violations"), (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data !== "object") {
        setSuperViolations([]);
        return;
      }
      const list: SuperViolationRow[] = Object.entries(data).map(([key, v]: any) => ({
        id: String(key),
        nisn: v?.nisn ? String(v.nisn) : "",
        type: v?.type ? String(v.type) : "",
        description: v?.description ? String(v.description) : "",
        timestamp: typeof v?.timestamp === "number" ? v.timestamp : null,
      }));
      list.sort((a, b) => (Number(b.timestamp || 0) || 0) - (Number(a.timestamp || 0) || 0));
      setSuperViolations(list.slice(0, 200));
    });

    const unsubPrincipals = onValue(ref(database, "principal_accounts"), (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data !== "object") {
        setSuperPrincipals([]);
        return;
      }
      const list: SuperPrincipalRow[] = Object.entries(data).map(([key, v]: any) => ({
        username: String(v?.username || key),
        name: String(v?.name || v?.nama || ""),
        schoolId: String(v?.schoolId || ""),
        schoolName: String(v?.schoolName || ""),
        isActive: v?.isActive !== false,
        deviceId: v?.deviceId ? String(v.deviceId) : null,
        credentialHash: v?.credentialHash ? String(v.credentialHash) : null,
        lastLoginAt: typeof v?.lastLoginAt === "number" ? v.lastLoginAt : null,
        createdAt: typeof v?.createdAt === "number" ? v.createdAt : null,
        updatedAt: typeof v?.updatedAt === "number" ? v.updatedAt : null,
      }));
      list.sort((a, b) => String(a.schoolName || a.schoolId).localeCompare(String(b.schoolName || b.schoolId)));
      setSuperPrincipals(list);
    });

    return () => {
      unsubSchools();
      unsubAdmins();
      unsubViolations();
      unsubPrincipals();
    };
  }, [isAuthenticated, mounted, user?.role, _hasHydrated, isEduLockAuthLoading]);

  const schoolId = useMemo(() => normalize(user?.schoolId), [user?.schoolId]);
  const schoolName = useMemo(() => normalize(user?.schoolName), [user?.schoolName]);
  const npsn = useMemo(() => normalize(user?.npsn), [user?.npsn]);
  const isSuperAdminScope = user?.role === "super_admin";
  const schoolScopeId = schoolId.toLowerCase();

  const callStudentAdminApi = async (
    method: "POST" | "PUT" | "DELETE",
    payload: StudentMutationApiPayload
  ) => {
    const currentUser = edulockAuth.currentUser;
    if (!currentUser) {
      throw new Error("Sesi EduLock tidak aktif. Silakan login ulang.");
    }

    const idToken = await currentUser.getIdToken();
    const response = await fetch("/api/admin/students", {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success === false) {
      throw new Error(String(result?.message || "Permintaan backend gagal diproses."));
    }

    return result;
  };

  const callPersonnelAdminApi = async (
    method: "POST" | "PUT" | "DELETE",
    payload: PersonnelMutationApiPayload
  ) => {
    const currentUser = edulockAuth.currentUser;
    if (!currentUser) {
      throw new Error("Sesi EduLock tidak aktif. Silakan login ulang.");
    }

    const idToken = await currentUser.getIdToken();
    const response = await fetch("/api/admin/personnel", {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success === false) {
      throw new Error(String(result?.message || "Permintaan backend personel gagal diproses."));
    }

    return result;
  };

  const callPrincipalAdminApi = async (
    method: "POST" | "PUT" | "DELETE",
    payload: PrincipalMutationApiPayload
  ) => {
    const currentUser = edulockAuth.currentUser;
    if (!currentUser) {
      throw new Error("Sesi EduLock tidak aktif. Silakan login ulang.");
    }

    const idToken = await currentUser.getIdToken();
    const response = await fetch("/api/admin/principals", {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success === false) {
      throw new Error(String(result?.message || "Permintaan backend akun kepala sekolah gagal diproses."));
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

  const matchesOwnedSchool = (recordSchoolId?: unknown) => {
    if (isSuperAdminScope) return true;
    const recordScope = normalize(recordSchoolId).toLowerCase();
    return Boolean(recordScope) && Boolean(schoolScopeId) && recordScope === schoolScopeId;
  };

  const getOwnedStudentRow = (nisnValue: string) =>
    studentRows.find((row) => normalize(row.nisn) === normalize(nisnValue) && matchesOwnedSchool(row.schoolId));

  const getOwnedTeacherRow = (nuptkValue: string) =>
    teacherRows.find((row) => normalize(row.nuptk) === normalize(nuptkValue) && matchesOwnedSchool(row.schoolId));

  const getOwnedStaffRow = (nisnValue: string) =>
    staffRows.find((row) => normalize(row.nisn) === normalize(nisnValue) && matchesOwnedSchool(row.schoolId));

  const getOwnedTatibRow = (usernameValue: string) =>
    tatibRows.find((row) => normalizeTatibUsername(row.username) === normalizeTatibUsername(usernameValue) && matchesOwnedSchool(row.schoolId));

  const latestRuntimeAdminBySchoolId = useMemo(() => {
    const map = new Map<string, SuperAdminProfileRow>();
    for (const admin of superAdmins) {
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
  }, [superAdmins]);

  const latestRuntimeAdminByEmail = useMemo(() => {
    const map = new Map<string, SuperAdminProfileRow>();
    for (const admin of superAdmins) {
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
  }, [superAdmins]);

  const latestRuntimeAdminByNpsn = useMemo(() => {
    const map = new Map<string, SuperAdminProfileRow>();
    for (const admin of superAdmins) {
      if (admin.role !== "admin") continue;
      const npsnValue = normalize(admin.npsn).toLowerCase();
      if (!npsnValue) continue;
      const existing = map.get(npsnValue);
      const currentTs = Number(admin.lastLoginAt || 0) || 0;
      const previousTs = Number(existing?.lastLoginAt || 0) || 0;
      if (!existing || currentTs >= previousTs) {
        map.set(npsnValue, admin);
      }
    }
    return map;
  }, [superAdmins]);

  const superSchoolAdmins = useMemo<SuperSchoolAdminRow[]>(() => {
    return superSchools.map((school) => {
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
        schoolActive: school.isActive,
        accessActive: school.adminAccessActive !== false,
        loginIdentifier,
        resetEmail: getSchoolAdminResetEmail(school),
        runtimeUid: String(runtime?.uid || ""),
        runtimeEmail: String(runtime?.email || ""),
        runtimeLastLoginAt: runtime?.lastLoginAt ?? null,
        runtimeMustChangePassword: runtime?.mustChangePassword === true,
        runtimeIsActive: runtime?.isActive !== false,
      };
    });
  }, [latestRuntimeAdminByEmail, latestRuntimeAdminByNpsn, latestRuntimeAdminBySchoolId, superSchools]);

  const schoolAdminRowBySchoolId = useMemo(() => {
    const map = new Map<string, SuperSchoolAdminRow>();
    for (const row of superSchoolAdmins) {
      map.set(normalize(row.schoolId).toLowerCase(), row);
    }
    return map;
  }, [superSchoolAdmins]);

  const principalBySchoolId = useMemo(() => {
    const map = new Map<string, SuperPrincipalRow>();
    for (const row of superPrincipals) {
      const key = normalize(row.schoolId).toLowerCase();
      if (!key) continue;
      if (!map.has(key)) map.set(key, row);
    }
    return map;
  }, [superPrincipals]);

  const superStats = useMemo(() => {
    const tenantsTotal = superSchools.length;
    const tenantsEnabled = superSchools.filter((s) => s.isActive).length;
    const tenantsLive = superSchoolAdmins.filter((row) => hasOperationalRuntime(row)).length;
    const adminsTotal = superSchoolAdmins.length;
    const adminsActive = superSchoolAdmins.filter((row) => row.accessActive && row.schoolActive).length;
    const tenantsWithAdmin = superSchoolAdmins.reduce((acc, row) => acc + (schoolHasAdminLoginConfig({ npsn: row.npsn, authEmail: row.loginIdentifier, adminEmail: "" }) ? 1 : 0), 0);
    const tenantsMissingAdmin = Math.max(0, tenantsTotal - tenantsWithAdmin);
    const principalsTotal = superPrincipals.length;
    const principalsActive = superPrincipals.filter((row) => row.isActive).length;
    const schoolsWithPrincipal = new Set(
      superPrincipals.map((row) => normalize(row.schoolId).toLowerCase()).filter(Boolean)
    );
    const schoolsMissingPrincipal = superSchools.filter((school) => !schoolsWithPrincipal.has(normalize(school.schoolId).toLowerCase())).length;
    return {
      tenantsTotal,
      tenantsEnabled,
      tenantsLive,
      adminsTotal,
      adminsActive,
      tenantsWithAdmin,
      tenantsMissingAdmin,
      principalsTotal,
      principalsActive,
      schoolsMissingPrincipal,
      violationsRecent: superViolations.length,
    };
  }, [superPrincipals, superSchoolAdmins, superSchools, superViolations]);

  const schoolsWithoutAdmin = useMemo(() => {
    return superSchoolAdmins.filter((row) => !schoolHasAdminLoginConfig({ npsn: row.npsn, authEmail: row.loginIdentifier, adminEmail: "" }));
  }, [superSchoolAdmins]);

  const schoolsWithoutPrincipal = useMemo(() => {
    const schoolIdsWithPrincipal = new Set(
      superPrincipals.map((row) => normalize(row.schoolId).toLowerCase()).filter(Boolean)
    );
    return superSchools.filter((school) => !schoolIdsWithPrincipal.has(normalize(school.schoolId).toLowerCase()));
  }, [superPrincipals, superSchools]);

  const filteredSuperPrincipals = useMemo(() => {
    const q = normalize(principalQuery).toLowerCase();
    if (!q) return superPrincipals;
    return superPrincipals.filter((p) => {
      const hay = `${p.username} ${p.name} ${p.schoolId} ${p.schoolName}`.toLowerCase();
      return hay.includes(q);
    });
  }, [principalQuery, superPrincipals]);

  const saveSuperSchool = async () => {
    const sid = normalize(superSchoolForm.schoolId);
    if (!sid) {
      setStatus({ type: "error", text: "School ID wajib diisi." });
      return;
    }

    setSuperSaving(true);
    setStatus({ type: "", text: "" });
    try {
      await callEduLockSuperApi("POST", {
        action: "save-school",
        school: {
          schoolId: sid,
          name: normalize(superSchoolForm.name),
          district: normalize(superSchoolForm.district),
          npsn: normalize(superSchoolForm.npsn),
          authEmail: normalize(superSchoolForm.authEmail).toLowerCase(),
          adminEmail: normalize(superSchoolForm.adminEmail).toLowerCase(),
          backupEmail: normalize(superSchoolForm.backupEmail).toLowerCase(),
          isActive: superSchoolForm.isActive,
        },
      });
      setStatus({ type: "success", text: "Sekolah berhasil disimpan." });
      setSuperSchoolForm({
        schoolId: "",
        name: "",
        district: "",
        npsn: "",
        authEmail: "",
        adminEmail: "",
        backupEmail: "",
        isActive: true,
      });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal simpan sekolah: ${String(e?.message || e)}` });
    } finally {
      setSuperSaving(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const resetAdminSchoolForm = () => {
    setAdminSchoolEditing("");
    setAdminSchoolForm({
      schoolId: "",
      schoolName: "",
      npsn: "",
      authEmail: "",
      adminEmail: "",
      backupEmail: "",
      schoolActive: true,
      adminAccessActive: true,
    });
  };

  const openAdminSchoolEditor = (school: SuperSchoolRow, adminRow?: SuperSchoolAdminRow | null) => {
    setAdminSchoolEditing(normalize(school.schoolId).toLowerCase());
    setAdminSchoolForm({
      schoolId: school.schoolId,
      schoolName: school.name,
      npsn: school.npsn,
      authEmail: school.authEmail,
      adminEmail: school.adminEmail,
      backupEmail: school.backupEmail,
      schoolActive: school.isActive,
      adminAccessActive: adminRow?.accessActive ?? school.adminAccessActive !== false,
    });
    setSuperSection("admins");
    router.replace("/super-admin/database?sub=admins");
  };

  const saveAdminSchoolRegistry = async () => {
    const sid = normalize(adminSchoolForm.schoolId);
    if (!sid) {
      setStatus({ type: "error", text: "Pilih sekolah terlebih dahulu." });
      return;
    }

    const school = superSchools.find((row) => normalize(row.schoolId).toLowerCase() === sid.toLowerCase());
    if (!school) {
      setStatus({ type: "error", text: "Data sekolah tidak ditemukan di registry." });
      return;
    }

    setSuperSaving(true);
    setStatus({ type: "", text: "" });
    try {
      const currentAccessActive = school.adminAccessActive !== false;
      await callEduLockSuperApi("POST", {
        action: "save-school",
        school: {
          schoolId: school.schoolId,
          name: normalize(school.name),
          district: normalize(school.district),
          npsn: normalize(adminSchoolForm.npsn || school.npsn),
          authEmail: normalize(adminSchoolForm.authEmail).toLowerCase(),
          adminEmail: normalize(adminSchoolForm.adminEmail).toLowerCase(),
          backupEmail: normalize(adminSchoolForm.backupEmail || school.backupEmail).toLowerCase(),
          isActive: adminSchoolForm.schoolActive,
        },
      });
      if (adminSchoolForm.adminAccessActive !== currentAccessActive) {
        await callEduLockSuperApi("PUT", {
          action: "toggle-school-admin-access",
          schoolId: school.schoolId,
          nextActive: adminSchoolForm.adminAccessActive,
        });
      }
      setStatus({
        type: "success",
        text:
          adminSchoolForm.adminAccessActive !== currentAccessActive
            ? "Konfigurasi login admin sekolah dan status akses berhasil disimpan."
            : "Konfigurasi login admin sekolah berhasil disimpan.",
      });
      resetAdminSchoolForm();
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal simpan login admin sekolah: ${String(e?.message || e)}` });
    } finally {
      setSuperSaving(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const bootstrapSchoolAdminLogin = async (row: SuperSchoolAdminRow | SuperAdminSchoolForm) => {
    const npsnValue = normalize(row.npsn);
    if (!npsnValue) {
      setStatus({ type: "error", text: "NPSN wajib tersedia untuk bootstrap login default admin sekolah." });
      return;
    }

    setSuperSaving(true);
    setStatus({ type: "", text: "" });
    try {
      const result = await callEduLockAuthApi({ action: "bootstrap-school-admin", npsn: npsnValue });
      setStatus({
        type: "success",
        text: result?.data?.created
          ? `Akun login default ${result?.data?.email || `${npsnValue}@edulock.local`} berhasil dibuat.`
          : result?.data?.defaultReady
            ? `Akun login default ${result?.data?.email || `${npsnValue}@edulock.local`} berhasil disiapkan ulang ke admin123.`
            : `Akun login default ${result?.data?.email || `${npsnValue}@edulock.local`} sudah pernah dipakai dan passwordnya tidak diubah otomatis.`,
      });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal bootstrap login default: ${String(e?.message || e)}` });
    } finally {
      setSuperSaving(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const toggleSuperSchoolActive = async (sid: string, next: boolean) => {
    setSuperSaving(true);
    setStatus({ type: "", text: "" });
    try {
      await callEduLockSuperApi("PUT", {
        action: "toggle-school-active",
        schoolId: sid,
        nextActive: next,
      });
      setStatus({ type: "success", text: "Status sekolah diperbarui." });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal update sekolah: ${String(e?.message || e)}` });
    } finally {
      setSuperSaving(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const toggleSuperAdminActive = async (uid: string, next: boolean) => {
    setSuperSaving(true);
    setStatus({ type: "", text: "" });
    try {
      await callEduLockSuperApi("PUT", {
        action: "toggle-admin-active",
        targetUid: uid,
        nextActive: next,
      });
      setStatus({ type: "success", text: "Status admin diperbarui." });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal update admin: ${String(e?.message || e)}` });
    } finally {
      setSuperSaving(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const toggleSchoolAdminAccess = async (schoolRow: SuperSchoolAdminRow, next: boolean) => {
    const schoolIdValue = normalize(schoolRow.schoolId);
    if (!schoolIdValue) return;
    setSuperSaving(true);
    setStatus({ type: "", text: "" });
    try {
      await callEduLockSuperApi("PUT", {
        action: "toggle-school-admin-access",
        schoolId: schoolIdValue,
        nextActive: next,
      });
      setStatus({ type: "success", text: "Akses admin sekolah diperbarui." });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal update akses admin sekolah: ${String(e?.message || e)}` });
    } finally {
      setSuperSaving(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const resetSchoolAdminPassword = async (schoolRow: SuperSchoolAdminRow) => {
    const schoolIdValue = normalize(schoolRow.schoolId).toLowerCase();
    if (!schoolIdValue) {
      setStatus({
        type: "error",
        text: "School ID tidak valid untuk reset password admin.",
      });
      return;
    }

    setSuperSaving(true);
    setStatus({ type: "", text: "" });
    try {
      await callEduLockSuperApi("PUT", {
        action: "reset-school-admin-default-password",
        schoolId: schoolIdValue,
      });
      setStatus({
        type: "success",
        text: `Reset Default berhasil untuk admin sekolah ${schoolRow.npsn || schoolRow.schoolId}. Username kembali ke NPSN dan password ke admin123.`,
      });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal menjalankan Reset Default: ${String(e?.message || e)}` });
    } finally {
      setSuperSaving(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const resetSuperAdminPassword = async (email: string) => {
    const target = normalize(email).toLowerCase();
    if (!target.includes("@") || target.endsWith("@edulock.local")) {
      setStatus({
        type: "error",
        text: "Reset via email tidak tersedia untuk akun sistem (@edulock.local).",
      });
      return;
    }

    setSuperSaving(true);
    setStatus({ type: "", text: "" });
    try {
      await callEduLockAuthApi({ action: "send-reset-email", email: target });
      setStatus({ type: "success", text: `Link reset password dikirim ke ${target}.` });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal kirim reset: ${String(e?.message || e)}` });
    } finally {
      setSuperSaving(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const normalizePrincipalUsername = (value: string) =>
    normalize(value)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

  const upsertPrincipalAccount = async () => {
    const usernameKey = normalizePrincipalUsername(principalForm.username);
    const schoolIdValue = normalize(principalForm.schoolId).trim();
    if (!usernameKey) {
      setStatus({ type: "error", text: "Username kepala sekolah wajib diisi." });
      return;
    }
    if (!schoolIdValue) {
      setStatus({ type: "error", text: "School ID wajib diisi." });
      return;
    }

    const existing = superPrincipals.find((p) => normalizePrincipalUsername(p.username) === usernameKey);
    const pickedSchool = superSchools.find((s) => normalize(s.schoolId).toLowerCase() === schoolIdValue.toLowerCase());
    const schoolNameValue = normalize(principalForm.schoolName || pickedSchool?.name || "");
    const displayNameValue = normalize(principalForm.name);

    if (!existing && !principalForm.password.trim()) {
      setStatus({ type: "error", text: "Password/NIP wajib diisi untuk akun baru." });
      return;
    }

    setPrincipalSaving(true);
    setStatus({ type: "", text: "" });
    try {
      await callPrincipalAdminApi(existing ? "PUT" : "POST", {
        username: usernameKey,
        name: displayNameValue,
        schoolId: schoolIdValue,
        schoolName: schoolNameValue,
        npsn: normalize(pickedSchool?.npsn || ""),
        password: principalForm.password.trim(),
        isActive: principalForm.isActive,
      });
      setStatus({ type: "success", text: existing ? "Akun kepala sekolah diperbarui." : "Akun kepala sekolah dibuat." });
      setPrincipalEditing("");
      setPrincipalForm({ username: "", name: "", schoolId: "", schoolName: "", password: "", isActive: true });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal simpan akun kepala sekolah: ${String(e?.message || e)}` });
    } finally {
      setPrincipalSaving(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const startEditPrincipal = (row: SuperPrincipalRow) => {
    setPrincipalEditing(normalizePrincipalUsername(row.username));
    setPrincipalForm({
      username: normalizePrincipalUsername(row.username),
      name: row.name || "",
      schoolId: row.schoolId || "",
      schoolName: row.schoolName || "",
      password: "",
      isActive: row.isActive !== false,
    });
  };

  const togglePrincipalActive = async (username: string, next: boolean) => {
    const key = normalizePrincipalUsername(username);
    if (!key) return;
    setPrincipalSaving(true);
    setStatus({ type: "", text: "" });
    try {
      await callPrincipalAdminApi("PUT", {
        action: "toggle-active",
        username: key,
        isActive: next,
      });
      setStatus({ type: "success", text: "Status kepala sekolah diperbarui." });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal update status kepala sekolah: ${String(e?.message || e)}` });
    } finally {
      setPrincipalSaving(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const resetPrincipalDevice = async (username: string) => {
    const key = normalizePrincipalUsername(username);
    if (!key) return;
    setPrincipalSaving(true);
    setStatus({ type: "", text: "" });
    try {
      await callPrincipalAdminApi("DELETE", {
        action: "reset-device",
        username: key,
      });
      setStatus({ type: "success", text: "Device kepala sekolah berhasil di-reset." });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal reset device: ${String(e?.message || e)}` });
    } finally {
      setPrincipalSaving(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const deletePrincipalAccount = async (username: string) => {
    const key = normalizePrincipalUsername(username);
    if (!key) return;
    setPrincipalSaving(true);
    setStatus({ type: "", text: "" });
    try {
      await callPrincipalAdminApi("DELETE", {
        username: key,
      });
      setStatus({ type: "success", text: "Akun kepala sekolah dihapus." });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal hapus akun kepala sekolah: ${String(e?.message || e)}` });
    } finally {
      setPrincipalSaving(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const activeSub = useMemo(() => {
    const raw = String(searchParams?.get("sub") || "students").toLowerCase();
    if (raw === "teachers") return "teachers";
    if (raw === "staff" || raw === "tatib") return "staff";
    if (raw === "classes") return "classes";
    return "students";
  }, [searchParams]);

  const activeSuperSub = useMemo<SuperDbSection>(() => {
    if (pathname !== "/super-admin/database") return "schools";
    const raw = String(searchParams?.get("sub") || "schools").toLowerCase();
    if (raw === "admins") return "admins";
    if (raw === "principals") return "principals";
    if (raw === "monitoring") return "monitoring";
    return "schools";
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!mounted || !_hasHydrated) return;
    if (!searchParams) return;
    const raw = String(searchParams.get("sub") || "").toLowerCase();
    if (raw === "tatib") {
      router.replace("/admin/students?sub=staff");
    }
  }, [mounted, _hasHydrated, router, searchParams]);

  useEffect(() => {
    if (!mounted || !_hasHydrated) return;
    if (!isAuthenticated || user?.role !== "super_admin") return;
    setSuperSection(activeSuperSub);
  }, [activeSuperSub, isAuthenticated, mounted, user?.role, _hasHydrated]);

  useEffect(() => {
    setQuery("");
    setStatus({ type: "", text: "" });
    if (activeSub !== "students" && activeSub !== "classes") {
      setClassCreateOpen(false);
      setClassCreateForm({ className: "" });
      setClassEditOpen(false);
      setClassEditingName("");
      setClassEditForm({ className: "" });
    }
  }, [activeSub]);

  useEffect(() => {
    if (activeSub !== "students") return;
    setStatusNow(Date.now());
    const timer = window.setInterval(() => setStatusNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [activeSub]);

  useEffect(() => {
    if (!mounted || !_hasHydrated) return;
    if (!isAuthenticated || user?.role !== "admin") return;
    if (activeSub !== "students" || !schoolId) {
      setActiveSessions([]);
      return;
    }

    const sessionsRef = ref(edulockDb, `active_sessions_by_school/${schoolId}`);
    const unsub = onValue(sessionsRef, (snap) => {
      const data = snap.val();
      if (!data || typeof data !== "object") {
        setActiveSessions([]);
        return;
      }

      const list: ActiveSessionRow[] = Object.entries(data).map(([key, value]: any) => ({
        nisn: String(value?.nisn || key || ""),
        isOnline: value?.isOnline === true,
        deviceStatus: value?.deviceStatus ? String(value.deviceStatus) : "",
        lastUpdated: typeof value?.lastUpdated === "number" ? value.lastUpdated : undefined,
        updatedAt: typeof value?.updatedAt === "number" ? value.updatedAt : undefined,
        lastSeen: typeof value?.lastSeen === "number" ? value.lastSeen : undefined,
      }));

      setActiveSessions(list);
    });

    return () => unsub();
  }, [activeSub, isAuthenticated, mounted, user?.role, _hasHydrated, schoolId]);

  useEffect(() => {
    if (!mounted || !_hasHydrated) return;
    if (!isAuthenticated || user?.role !== "admin") return;
    const unsubs: Array<() => void> = [];

    if (activeSub === "students" || activeSub === "staff" || activeSub === "classes") {
      const baseRef = ref(database, "master_students");
      const unsub = onValue(baseRef, (snap) => {
        const data = snap.val();
        if (!data || typeof data !== "object") {
          setStudentRows([]);
          setLastSyncAt(Date.now());
          return;
        }
        const list: StudentRow[] = Object.entries(data)
          .map(([key, v]: any) => {
            const obj = v || {};
            const rowSchoolId = normalize(obj?.schoolId).toLowerCase();
            if (schoolScopeId && rowSchoolId !== schoolScopeId) return null;

            const religionRaw = normalize(obj?.religion || obj?.agama).toUpperCase();
            return {
              nisn: String(obj?.nisn || key || ""),
              name: String(obj?.name || ""),
              gender: obj?.gender === "L" || obj?.gender === "P" ? obj.gender : "",
              religion: religionRaw === "NON_ISLAM" ? "NON_ISLAM" : religionRaw ? "ISLAM" : "",
              class: String(obj?.class || ""),
              status: obj?.status === "Nonaktif" ? "Nonaktif" : "Aktif",
              device: obj?.device ? String(obj.device) : "",
              schoolId: obj?.schoolId ? String(obj.schoolId) : undefined,
              schoolName: obj?.schoolName ? String(obj.schoolName) : undefined,
              npsn: obj?.npsn ? String(obj.npsn) : undefined,
              createdAt: typeof obj?.createdAt === "number" ? obj.createdAt : undefined,
              updatedAt: typeof obj?.updatedAt === "number" ? obj.updatedAt : undefined,
            };
          })
          .filter(Boolean) as StudentRow[];
        list.sort((a, b) => (Number(b.updatedAt || b.createdAt || 0) || 0) - (Number(a.updatedAt || a.createdAt || 0) || 0));
        setStudentRows(list);
        setLastSyncAt(Date.now());
      });
      unsubs.push(unsub);
    }

    if (activeSub === "tatib") {
      const baseRef = schoolId
        ? dbQuery(ref(database, "staff"), orderByChild("schoolId"), equalTo(schoolId))
        : ref(database, "staff");
      const unsub = onValue(baseRef, (snap) => {
        const data = snap.val();
        if (!data || typeof data !== "object") {
          setTatibRows([]);
          setLastSyncAt(Date.now());
          return;
        }
        const list: TatibRow[] = Object.entries(data).map(([key, v]: any) => {
          const obj = v || {};
          return {
            username: String(obj?.username || key || ""),
            name: String(obj?.name || ""),
            password: obj?.password ? String(obj.password) : "",
            role: obj?.role ? String(obj.role) : "",
            isActive: typeof obj?.isActive === "boolean" ? obj.isActive : true,
            deviceId: obj?.deviceId ? String(obj.deviceId) : obj?.device ? String(obj.device) : "",
            schoolId: obj?.schoolId ? String(obj.schoolId) : undefined,
            schoolName: obj?.schoolName ? String(obj.schoolName) : undefined,
            npsn: obj?.npsn ? String(obj.npsn) : undefined,
            createdAt: typeof obj?.createdAt === "number" ? obj.createdAt : undefined,
            updatedAt: typeof obj?.updatedAt === "number" ? obj.updatedAt : undefined,
          };
        });
        const sid = normalize(schoolId).toLowerCase();
        const filtered = sid
          ? list.filter((r) => !normalize(r.schoolId).toLowerCase() || normalize(r.schoolId).toLowerCase() === sid)
          : list;
        filtered.sort(
          (a, b) => (Number(b.updatedAt || b.createdAt || 0) || 0) - (Number(a.updatedAt || a.createdAt || 0) || 0),
        );
        setTatibRows(filtered);
        setLastSyncAt(Date.now());
      });
      unsubs.push(unsub);
    }

    if (activeSub === "students" || activeSub === "teachers" || activeSub === "classes") {
      if (!schoolId) {
        setClassRows([]);
        setLastSyncAt(Date.now());
      } else {
        const baseRef = ref(database, `master_classes/${schoolId}`);
        const unsub = onValue(baseRef, (snap) => {
          const data = snap.val();
          if (!data || typeof data !== "object") {
            setClassRows([]);
            setLastSyncAt(Date.now());
            return;
          }
          const list: ClassRow[] = Object.entries(data).map(([key, v]: any) => {
            const obj = v || {};
            const className = normalize(obj?.class || obj?.className || key);
            const gradeRaw = typeof obj?.grade === "number" ? obj.grade : toGradeFromClass(className);
            const grade = gradeRaw === 7 || gradeRaw === 8 || gradeRaw === 9 ? gradeRaw : 7;
            return {
              className,
              grade,
              disabled: Boolean(obj?.disabled),
              schoolId: obj?.schoolId ? String(obj.schoolId) : schoolId,
              schoolName: obj?.schoolName ? String(obj.schoolName) : undefined,
              npsn: obj?.npsn ? String(obj.npsn) : undefined,
              createdAt: typeof obj?.createdAt === "number" ? obj.createdAt : undefined,
              updatedAt: typeof obj?.updatedAt === "number" ? obj.updatedAt : undefined,
            };
          });
          list.sort((a, b) => a.className.localeCompare(b.className));
          setClassRows(list);
          setLastSyncAt(Date.now());
        });
        unsubs.push(unsub);
      }
    }

    if (activeSub === "teachers") {
      const baseRef = schoolId
        ? dbQuery(ref(database, "master_teachers"), orderByChild("schoolId"), equalTo(schoolId))
        : ref(database, "master_teachers");
      const unsub = onValue(baseRef, (snap) => {
        const data = snap.val();
        if (!data || typeof data !== "object") {
          setTeacherRows([]);
          setLastSyncAt(Date.now());
          return;
        }
        const list: TeacherRow[] = Object.entries(data).map(([key, v]: any) => {
          const obj = v || {};
          return {
            nuptk: String(obj?.nuptk || key || ""),
            name: String(obj?.name || ""),
            class: String(obj?.class || obj?.homeroomClass || ""),
            status: obj?.status === "Nonaktif" ? "Nonaktif" : "Aktif",
            deviceId: obj?.deviceId ? String(obj.deviceId) : obj?.device ? String(obj.device) : "",
            schoolId: obj?.schoolId ? String(obj.schoolId) : undefined,
            schoolName: obj?.schoolName ? String(obj.schoolName) : undefined,
            npsn: obj?.npsn ? String(obj.npsn) : undefined,
            createdAt: typeof obj?.createdAt === "number" ? obj.createdAt : undefined,
            updatedAt: typeof obj?.updatedAt === "number" ? obj.updatedAt : undefined,
          };
        });
        list.sort((a, b) => (Number(b.updatedAt || b.createdAt || 0) || 0) - (Number(a.updatedAt || a.createdAt || 0) || 0));
        setTeacherRows(list);
        setLastSyncAt(Date.now());
      });
      unsubs.push(unsub);
    }

    if (activeSub === "staff") {
      const baseRef = schoolId
        ? dbQuery(ref(database, "master_staff"), orderByChild("schoolId"), equalTo(schoolId))
        : ref(database, "master_staff");
      const unsub = onValue(baseRef, (snap) => {
        const data = snap.val();
        if (!data || typeof data !== "object") {
          setStaffRows([]);
          setLastSyncAt(Date.now());
          return;
        }
        const list: StaffRow[] = Object.entries(data).map(([key, v]: any) => {
          const obj = v || {};
          const roleValue = String(obj?.role || "").toLowerCase();
          return {
            nisn: String(obj?.nisn || key || ""),
            position: obj?.position ? String(obj.position) : "",
            role: roleValue === "osis" ? "osis" : "",
            status: obj?.status === "Nonaktif" ? "Nonaktif" : "Aktif",
            schoolId: obj?.schoolId ? String(obj.schoolId) : undefined,
            schoolName: obj?.schoolName ? String(obj.schoolName) : undefined,
            npsn: obj?.npsn ? String(obj.npsn) : undefined,
            createdAt: typeof obj?.createdAt === "number" ? obj.createdAt : undefined,
            updatedAt: typeof obj?.updatedAt === "number" ? obj.updatedAt : undefined,
          };
        });
        list.sort((a, b) => (Number(b.updatedAt || b.createdAt || 0) || 0) - (Number(a.updatedAt || a.createdAt || 0) || 0));
        setStaffRows(list);
        setLastSyncAt(Date.now());
      });
      unsubs.push(unsub);
    }

    if (unsubs.length === 0) setLastSyncAt(Date.now());

    return () => {
      for (const u of unsubs) u();
    };
  }, [activeSub, isAuthenticated, mounted, user?.role, _hasHydrated, schoolId, schoolScopeId]);

  const gradeTabs = useMemo(() => [7, 8, 9] as const, []);

  useEffect(() => {
    if (!gradeTabs.includes(selectedGrade)) setSelectedGrade(gradeTabs[0]);
  }, [gradeTabs, selectedGrade]);

  const classOptions = useMemo(() => {
    const baseBySchool = schoolId
      ? studentRows.filter((r) => normalize(r.schoolId).toLowerCase() === schoolId.toLowerCase())
      : studentRows;
    const inGrade = baseBySchool.filter((r) => toGradeFromClass(r.class) === selectedGrade);
    const classesFromStudents = inGrade.map((r) => normalize(r.class)).filter(Boolean);
    const disabledSet = new Set(
      classRows
        .filter((r) => r.disabled)
        .map((r) => normalize(r.className).toUpperCase())
        .filter(Boolean),
    );
    const classesFromManual = classRows
      .filter((r) => r.grade === selectedGrade && !r.disabled)
      .map((r) => normalize(r.className))
      .filter(Boolean);

    const uniq = Array.from(new Set([...classesFromManual, ...classesFromStudents]))
      .filter((c) => !disabledSet.has(normalize(c).toUpperCase()))
      .sort(compareClassNames);
    return uniq;
  }, [classRows, studentRows, schoolId, selectedGrade]);

  const allowedStudentClassSet = useMemo(() => {
    return new Set(classOptions.map((c) => normalize(c).toUpperCase()).filter(Boolean));
  }, [classOptions]);

  const teacherClassOptions = useMemo(() => {
    const disabledSet = new Set(
      classRows
        .filter((r) => r.disabled)
        .map((r) => normalize(r.className).toUpperCase())
        .filter(Boolean),
    );
    const baseBySchool = schoolId
      ? studentRows.filter((r) => normalize(r.schoolId).toLowerCase() === schoolId.toLowerCase())
      : studentRows;
    const classesFromStudents = baseBySchool.map((r) => normalize(r.class)).filter(Boolean);
    const manual = classRows.filter((r) => !r.disabled).map((r) => normalize(r.className)).filter(Boolean);
    const uniq = Array.from(new Set([...manual, ...classesFromStudents]))
      .filter((c) => !disabledSet.has(normalize(c).toUpperCase()))
      .sort(compareClassNames);
    return uniq;
  }, [classRows, schoolId, studentRows]);

  const allowedTeacherClassSet = useMemo(() => {
    return new Set(teacherClassOptions.map((c) => normalize(c).toUpperCase()).filter(Boolean));
  }, [teacherClassOptions]);

  const studentCountByClass = useMemo(() => {
    const map = new Map<string, number>();
    const baseBySchool = schoolId
      ? studentRows.filter((r) => normalize(r.schoolId).toLowerCase() === schoolId.toLowerCase())
      : studentRows;
    for (const r of baseBySchool) {
      const key = normalize(r.class).toUpperCase();
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [schoolId, studentRows]);

  const manualClassMap = useMemo(() => {
    const map = new Map<string, ClassRow>();
    for (const r of classRows) {
      map.set(normalize(r.className).toUpperCase(), r);
    }
    return map;
  }, [classRows]);

  useEffect(() => {
    if (!selectedClass) {
      setSelectedClass(classOptions[0] || "");
      return;
    }
    if (classOptions.length > 0 && !classOptions.includes(selectedClass)) {
      setSelectedClass(classOptions[0] || "");
    }
  }, [classOptions, selectedClass]);

  const filtered = useMemo(() => {
    const q = normalize(query).toLowerCase();
    const baseBySchool = schoolId
      ? studentRows.filter((r) => normalize(r.schoolId).toLowerCase() === schoolId.toLowerCase())
      : studentRows;
    const baseByGrade = baseBySchool.filter((r) => toGradeFromClass(r.class) === selectedGrade);
    const baseByClass = selectedClass
      ? baseByGrade.filter((r) => normalize(r.class).toUpperCase() === normalize(selectedClass).toUpperCase())
      : baseByGrade;
    if (!q) return baseByClass;
    return baseByClass.filter((r) => {
      const hay = `${r.nisn} ${r.name} ${r.class}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, studentRows, schoolId, selectedClass, selectedGrade]);

  const activeSessionByNisn = useMemo(() => {
    const map = new Map<string, ActiveSessionRow>();
    for (const session of activeSessions) {
      const key = normalize(session.nisn);
      if (!key) continue;
      map.set(key, session);
    }
    return map;
  }, [activeSessions]);

  const getStudentOnlineMeta = (nisnValue: string) => {
    const session = activeSessionByNisn.get(normalize(nisnValue));
    const lastSeenAt = Math.max(
      Number(session?.lastUpdated || 0),
      Number(session?.updatedAt || 0),
      Number(session?.lastSeen || 0),
    );
    const isOnline =
      session?.isOnline === true ||
      normalize(session?.deviceStatus).toLowerCase() === "online" ||
      (lastSeenAt > 0 && statusNow - lastSeenAt < 5 * 60 * 1000);

    return { isOnline, lastSeenAt };
  };

  const filteredTeachers = useMemo(() => {
    const q = normalize(query).toLowerCase();
    const baseBySchool = schoolId
      ? teacherRows.filter((r) => normalize(r.schoolId).toLowerCase() === schoolId.toLowerCase())
      : teacherRows;
    if (!q) return baseBySchool;
    return baseBySchool.filter((r) => {
      const hay = `${r.nuptk} ${r.name} ${r.class}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, teacherRows, schoolId]);

  const filteredStaff = useMemo(() => {
    const q = normalize(query).toLowerCase();
    const baseBySchool = schoolId ? staffRows.filter((r) => normalize(r.schoolId).toLowerCase() === schoolId.toLowerCase()) : staffRows;
    const osisOnly = baseBySchool.filter((r) => (r.role || "osis") === "osis");
    if (!q) return osisOnly;
    return osisOnly.filter((r) => {
      const student = studentRows.find((s) => normalize(s.nisn) === normalize(r.nisn));
      const hay = `${r.nisn} ${student?.name || ""} ${student?.class || ""} ${r.position || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, staffRows, schoolId, studentRows]);

  const filteredTatib = useMemo(() => {
    const q = normalize(query).toLowerCase();
    const baseBySchool = schoolId ? tatibRows.filter((r) => !normalize(r.schoolId) || normalize(r.schoolId).toLowerCase() === schoolId.toLowerCase()) : tatibRows;
    if (!q) return baseBySchool;
    return baseBySchool.filter((r) => {
      const hay = `${r.username} ${r.name}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, tatibRows, schoolId]);

  const staffCandidateStudent = useMemo(() => {
    const nisnValue = normalize(staffCreateForm.nisn);
    if (!nisnValue) return null;
    const found = studentRows.find((s) => normalize(s.nisn) === nisnValue);
    if (!found) return null;
    if (schoolId && normalize(found.schoolId).toLowerCase() !== schoolId.toLowerCase()) return null;
    return found;
  }, [schoolId, staffCreateForm.nisn, studentRows]);

  const handleCreate = async () => {
    setStatus({ type: "", text: "" });
    setBusy(true);
    try {
      const nisnValue = normalize(createForm.nisn);
      const nameValue = normalize(createForm.name);
      const classValue = normalize(createForm.class);
      if (!nisnValue || !nameValue || !classValue) {
        setStatus({ type: "error", text: "NISN, Nama, dan Kelas wajib diisi." });
        return;
      }
      if (!allowedStudentClassSet.has(normalize(classValue).toUpperCase())) {
        setStatus({ type: "error", text: "Kelas harus dipilih dari daftar Kelas Paralel yang tersedia." });
        return;
      }
      if (!schoolId) {
        setStatus({ type: "error", text: "Profil admin belum memiliki schoolId. Hubungi admin pusat." });
        return;
      }

      await callStudentAdminApi("POST", {
        nisn: nisnValue,
        name: nameValue,
        gender: createForm.gender,
        religion: createForm.religion,
        className: classValue,
        status: "Aktif",
        schoolId,
        schoolName,
        npsn,
      });

      setCreateForm({ nisn: "", name: "", gender: "L", religion: "ISLAM", class: "" });
      setCreateOpen(false);
      setStatus({ type: "success", text: "Siswa berhasil ditambahkan." });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal menambahkan siswa: ${String(e?.message || e)}` });
    } finally {
      setBusy(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const startEdit = (r: StudentRow) => {
    setEditingNisn(r.nisn);
    setEditForm({
      name: r.name || "",
      gender: r.gender === "L" || r.gender === "P" ? r.gender : "",
      class: r.class || "",
      status: r.status === "Nonaktif" ? "Nonaktif" : "Aktif",
    });
  };

  const cancelEdit = () => {
    setEditingNisn("");
    setEditForm({ name: "", gender: "", class: "", status: "Aktif" });
  };

  const saveEdit = async (nisnValue: string) => {
    setStatus({ type: "", text: "" });
    setBusy(true);
    try {
      const nameValue = normalize(editForm.name);
      const classValue = normalize(editForm.class);
      if (!nameValue || !classValue) {
        setStatus({ type: "error", text: "Nama dan Kelas wajib diisi." });
        return;
      }
      if (!allowedStudentClassSet.has(normalize(classValue).toUpperCase())) {
        setStatus({ type: "error", text: "Kelas harus dipilih dari daftar Kelas Paralel yang tersedia." });
        return;
      }
      await callStudentAdminApi("PUT", {
        nisn: nisnValue,
        previousNisn: nisnValue,
        name: nameValue,
        gender: editForm.gender || "",
        religion: "ISLAM",
        className: classValue,
        status: editForm.status,
        schoolId,
        schoolName,
        npsn,
      });
      setStatus({ type: "success", text: "Siswa berhasil diperbarui." });
      cancelEdit();
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal menyimpan: ${String(e?.message || e)}` });
    } finally {
      setBusy(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const deleteSelectedGradeStudents = async () => {
    setStatus({ type: "", text: "" });
    setBusy(true);
    try {
      if (!schoolId) {
        setStatus({ type: "error", text: "Profil admin belum memiliki schoolId. Hubungi admin pusat." });
        return;
      }
      if (selectedGrade !== 9) {
        setStatus({ type: "error", text: "Fitur ini khusus untuk menghapus jenjang 9." });
        return;
      }
      const label = "Kelas 9 (IX-*)";
      if (!window.confirm(`Hapus semua data siswa untuk ${label} di sekolah ini?`)) return;
      const result = await callStudentAdminApi("DELETE", {
        action: "delete-grade",
        schoolId,
        schoolName,
        npsn,
        grade: selectedGrade,
      });
      const count = Number(result?.data?.count || 0);
      setStatus({
        type: "success",
        text: count > 0 ? `Berhasil menghapus ${count} siswa pada ${label}.` : "Tidak ada siswa pada jenjang ini.",
      });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal menghapus jenjang: ${String(e?.message || e)}` });
    } finally {
      setBusy(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const resetStudentDeviceBinding = async (nisnValue: string) => {
    if (!window.confirm("Reset device binding siswa ini? Siswa bisa login lagi dari perangkat baru.")) return;
    setStatus({ type: "", text: "" });
    setBusy(true);
    try {
      const normalizedNisn = normalize(nisnValue);
      if (!normalizedNisn) {
        setStatus({ type: "error", text: "NISN tidak valid." });
        return;
      }
      const targetStudent = getOwnedStudentRow(normalizedNisn);
      if (!targetStudent) {
        setStatus({ type: "error", text: "Siswa tidak ditemukan pada tenant Anda." });
        return;
      }

      await callStudentAdminApi("DELETE", {
        nisn: normalizedNisn,
        action: "reset-device",
        schoolId: normalize(targetStudent.schoolId || schoolId),
        schoolName: normalize(targetStudent.schoolName || schoolName),
        npsn: normalize(targetStudent.npsn || npsn),
      });
      setStatus({ type: "success", text: "Device binding siswa berhasil direset." });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal reset device binding: ${String(e?.message || e)}` });
    } finally {
      setBusy(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const deleteRow = async (nisnValue: string) => {
    setStatus({ type: "", text: "" });
    setBusy(true);
    try {
      const normalizedNisn = normalize(nisnValue);
      const targetStudent = getOwnedStudentRow(normalizedNisn);
      if (!normalizedNisn || !targetStudent) {
        setStatus({ type: "error", text: "Siswa tidak ditemukan pada tenant Anda." });
        return;
      }
      await callStudentAdminApi("DELETE", {
        nisn: normalizedNisn,
        schoolId: normalize(targetStudent.schoolId || schoolId),
        schoolName: normalize(targetStudent.schoolName || schoolName),
        npsn: normalize(targetStudent.npsn || npsn),
      });
      setStatus({ type: "success", text: "Siswa berhasil dihapus." });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal menghapus: ${String(e?.message || e)}` });
    } finally {
      setBusy(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const handleTeacherCreate = async () => {
    setStatus({ type: "", text: "" });
    setBusy(true);
    try {
      const nuptkValue = normalize(teacherCreateForm.nuptk);
      const nameValue = normalize(teacherCreateForm.name);
      const classValue = normalize(teacherCreateForm.class);
      if (!nuptkValue || !nameValue || !classValue) {
        setStatus({ type: "error", text: "NUPTK, Nama, dan Kelas wajib diisi." });
        return;
      }
      if (!allowedTeacherClassSet.has(normalize(classValue).toUpperCase())) {
        setStatus({ type: "error", text: "Kelas harus dipilih dari daftar Kelas Paralel yang tersedia." });
        return;
      }
      if (!schoolId) {
        setStatus({ type: "error", text: "Profil admin belum memiliki schoolId. Hubungi admin pusat." });
        return;
      }
      await callPersonnelAdminApi("POST", {
        entity: "teacher",
        nuptk: nuptkValue,
        name: nameValue,
        className: classValue,
        status: "Aktif",
        schoolId,
        schoolName,
        npsn,
      });
      setTeacherCreateForm({ nuptk: "", name: "", class: "" });
      setTeacherCreateOpen(false);
      setStatus({ type: "success", text: "Guru/Wali Kelas berhasil ditambahkan." });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal menambahkan: ${String(e?.message || e)}` });
    } finally {
      setBusy(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const startTeacherEdit = (r: TeacherRow) => {
    setTeacherEditingNuptk(r.nuptk);
    setTeacherEditForm({
      name: r.name || "",
      class: r.class || "",
      status: r.status === "Nonaktif" ? "Nonaktif" : "Aktif",
    });
    setTeacherEditOpen(true);
  };

  const cancelTeacherEdit = () => {
    setTeacherEditOpen(false);
    setTeacherEditingNuptk("");
    setTeacherEditForm({ name: "", class: "", status: "Aktif" });
  };

  const saveTeacherEdit = async () => {
    setStatus({ type: "", text: "" });
    setBusy(true);
    try {
      const nuptkValue = normalize(teacherEditingNuptk);
      const nameValue = normalize(teacherEditForm.name);
      const classValue = normalize(teacherEditForm.class);
      if (!nuptkValue) {
        setStatus({ type: "error", text: "NUPTK tidak valid." });
        return;
      }
      if (!nameValue || !classValue) {
        setStatus({ type: "error", text: "Nama dan Kelas wajib diisi." });
        return;
      }
      if (!getOwnedTeacherRow(nuptkValue)) {
        setStatus({ type: "error", text: "Guru tidak ditemukan pada tenant Anda." });
        return;
      }
      if (!allowedTeacherClassSet.has(normalize(classValue).toUpperCase())) {
        setStatus({ type: "error", text: "Kelas harus dipilih dari daftar Kelas Paralel yang tersedia." });
        return;
      }
      await callPersonnelAdminApi("PUT", {
        entity: "teacher",
        nuptk: nuptkValue,
        name: nameValue,
        className: classValue,
        status: teacherEditForm.status,
        schoolId,
        schoolName,
        npsn,
      });
      setStatus({ type: "success", text: "Data guru berhasil diperbarui." });
      cancelTeacherEdit();
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal menyimpan: ${String(e?.message || e)}` });
    } finally {
      setBusy(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const deleteTeacherRow = async (nuptkValue: string) => {
    if (!window.confirm("Hapus data guru ini?")) return;
    setStatus({ type: "", text: "" });
    setBusy(true);
    try {
      const normalizedNuptk = normalize(nuptkValue);
      if (!normalizedNuptk || !getOwnedTeacherRow(normalizedNuptk)) {
        setStatus({ type: "error", text: "Guru tidak ditemukan pada tenant Anda." });
        return;
      }
      await callPersonnelAdminApi("DELETE", {
        entity: "teacher",
        nuptk: normalizedNuptk,
        schoolId,
        schoolName,
        npsn,
      });
      setStatus({ type: "success", text: "Guru berhasil dihapus." });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal menghapus: ${String(e?.message || e)}` });
    } finally {
      setBusy(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const resetTeacherDeviceBinding = async (nuptkValue: string) => {
    if (!window.confirm("Reset device binding guru/wali kelas ini? Akun bisa login lagi dari perangkat baru.")) return;
    setStatus({ type: "", text: "" });
    setBusy(true);
    try {
      const normalizedNuptk = normalize(nuptkValue);
      const targetTeacher = getOwnedTeacherRow(normalizedNuptk);
      if (!normalizedNuptk || !targetTeacher) {
        setStatus({ type: "error", text: "Guru tidak ditemukan pada tenant Anda." });
        return;
      }

      await callPersonnelAdminApi("DELETE", {
        entity: "teacher",
        action: "reset-device",
        nuptk: normalizedNuptk,
        schoolId: normalize(targetTeacher.schoolId || schoolId),
        schoolName: normalize(targetTeacher.schoolName || schoolName),
        npsn: normalize(targetTeacher.npsn || npsn),
      });
      setStatus({ type: "success", text: "Device binding guru berhasil direset." });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal reset device binding guru: ${String(e?.message || e)}` });
    } finally {
      setBusy(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const handleStaffCreate = async () => {
    setStatus({ type: "", text: "" });
    setBusy(true);
    try {
      const nisnValue = normalize(staffCreateForm.nisn);
      const positionValue = normalize(staffCreateForm.position);
      if (!nisnValue) {
        setStatus({ type: "error", text: "NISN wajib diisi." });
        return;
      }
      if (!schoolId) {
        setStatus({ type: "error", text: "Profil admin belum memiliki schoolId. Hubungi admin pusat." });
        return;
      }
      const student = studentRows.find((s) => normalize(s.nisn) === nisnValue);
      if (!student) {
        setStatus({ type: "error", text: "NISN belum ada di Database Siswa. Tambahkan siswa dulu di menu Siswa." });
        return;
      }
      if (normalize(student.schoolId).toLowerCase() !== schoolId.toLowerCase()) {
        setStatus({ type: "error", text: "Siswa ini bukan milik sekolah Anda." });
        return;
      }
      await callPersonnelAdminApi("POST", {
        entity: "staff",
        nisn: nisnValue,
        position: positionValue,
        status: "Aktif",
        schoolId,
        schoolName,
        npsn,
      });
      setStaffCreateForm({ nisn: "", position: "" });
      setStaffCreateOpen(false);
      setStatus({ type: "success", text: "Petugas (OSIS) berhasil ditambahkan." });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal menambahkan: ${String(e?.message || e)}` });
    } finally {
      setBusy(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const startStaffEdit = (r: StaffRow) => {
    setStaffEditingNisn(r.nisn);
    setStaffEditForm({
      position: r.position || "",
      status: r.status === "Nonaktif" ? "Nonaktif" : "Aktif",
    });
    setStaffEditOpen(true);
  };

  const cancelStaffEdit = () => {
    setStaffEditOpen(false);
    setStaffEditingNisn("");
    setStaffEditForm({ position: "", status: "Aktif" });
  };

  const saveStaffEdit = async () => {
    setStatus({ type: "", text: "" });
    setBusy(true);
    try {
      const nisnValue = normalize(staffEditingNisn);
      const positionValue = normalize(staffEditForm.position);
      if (!nisnValue) {
        setStatus({ type: "error", text: "NISN tidak valid." });
        return;
      }
      if (!getOwnedStaffRow(nisnValue)) {
        setStatus({ type: "error", text: "Petugas tidak ditemukan pada tenant Anda." });
        return;
      }
      await callPersonnelAdminApi("PUT", {
        entity: "staff",
        nisn: nisnValue,
        position: positionValue,
        status: staffEditForm.status,
        schoolId,
        schoolName,
        npsn,
      });
      setStatus({ type: "success", text: "Data petugas (OSIS) berhasil diperbarui." });
      cancelStaffEdit();
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal menyimpan: ${String(e?.message || e)}` });
    } finally {
      setBusy(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const deleteStaffRow = async (nisnValue: string) => {
    if (!window.confirm("Hapus petugas (OSIS) ini?")) return;
    setStatus({ type: "", text: "" });
    setBusy(true);
    try {
      const normalizedNisn = normalize(nisnValue);
      if (!normalizedNisn || !getOwnedStaffRow(normalizedNisn)) {
        setStatus({ type: "error", text: "Petugas tidak ditemukan pada tenant Anda." });
        return;
      }
      await callPersonnelAdminApi("DELETE", {
        entity: "staff",
        nisn: normalizedNisn,
        schoolId,
        schoolName,
        npsn,
      });
      setStatus({ type: "success", text: "Petugas (OSIS) berhasil dihapus." });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal menghapus: ${String(e?.message || e)}` });
    } finally {
      setBusy(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const normalizeTatibUsername = (value: unknown) => {
    return normalize(value).toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  };

  const handleTatibCreate = async () => {
    setStatus({ type: "", text: "" });
    setBusy(true);
    try {
      const username = normalizeTatibUsername(tatibCreateForm.username);
      const nameValue = normalize(tatibCreateForm.name);
      const passwordValue = normalize(tatibCreateForm.password);
      const isActive = Boolean(tatibCreateForm.isActive);
      if (!username || !nameValue || !passwordValue) {
        setStatus({ type: "error", text: "Nama, Username, dan Password wajib diisi." });
        return;
      }
      if (!schoolId) {
        setStatus({ type: "error", text: "Profil admin belum memiliki schoolId. Hubungi admin pusat." });
        return;
      }
      await callPersonnelAdminApi("POST", {
        entity: "tatib",
        username,
        name: nameValue,
        password: passwordValue,
        isActive,
        schoolId,
        schoolName,
        npsn,
      });
      setTatibCreateForm({ name: "", username: "", password: "", isActive: true });
      setTatibCreateOpen(false);
      setStatus({ type: "success", text: "Petugas OSIS berhasil ditambahkan." });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal menambahkan petugas: ${String(e?.message || e)}` });
    } finally {
      setBusy(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const startTatibEdit = (r: TatibRow) => {
    setTatibEditingUsername(r.username);
    setTatibEditForm({
      name: r.name || "",
      password: r.password || "",
      isActive: r.isActive !== false,
    });
    setTatibEditOpen(true);
  };

  const cancelTatibEdit = () => {
    setTatibEditOpen(false);
    setTatibEditingUsername("");
    setTatibEditForm({ name: "", password: "", isActive: true });
  };

  const saveTatibEdit = async () => {
    setStatus({ type: "", text: "" });
    setBusy(true);
    try {
      const username = normalizeTatibUsername(tatibEditingUsername);
      const nameValue = normalize(tatibEditForm.name);
      const passwordValue = normalize(tatibEditForm.password);
      const isActive = Boolean(tatibEditForm.isActive);
      if (!username) {
        setStatus({ type: "error", text: "Username tidak valid." });
        return;
      }
      if (!nameValue || !passwordValue) {
        setStatus({ type: "error", text: "Nama dan Password wajib diisi." });
        return;
      }
      if (!getOwnedTatibRow(username)) {
        setStatus({ type: "error", text: "Petugas OSIS tidak ditemukan pada tenant Anda." });
        return;
      }
      await callPersonnelAdminApi("PUT", {
        entity: "tatib",
        username,
        name: nameValue,
        password: passwordValue,
        isActive,
        schoolId,
        schoolName,
        npsn,
      });
      setStatus({ type: "success", text: "Data Petugas OSIS berhasil diperbarui." });
      cancelTatibEdit();
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal menyimpan: ${String(e?.message || e)}` });
    } finally {
      setBusy(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const resetTatibDevice = async (usernameValue: string) => {
    if (!window.confirm("Reset device petugas ini? Mereka bisa login dengan perangkat baru.")) return;
    setStatus({ type: "", text: "" });
    setBusy(true);
    try {
      const username = normalizeTatibUsername(usernameValue);
      if (!username) {
        setStatus({ type: "error", text: "Username tidak valid." });
        return;
      }
      if (!getOwnedTatibRow(username)) {
        setStatus({ type: "error", text: "Petugas OSIS tidak ditemukan pada tenant Anda." });
        return;
      }
      await callPersonnelAdminApi("DELETE", {
        entity: "tatib",
        action: "reset-device",
        username,
        schoolId,
        schoolName,
        npsn,
      });
      setStatus({ type: "success", text: "Device petugas berhasil direset." });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal reset device: ${String(e?.message || e)}` });
    } finally {
      setBusy(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const deleteTatibRow = async (usernameValue: string) => {
    if (!window.confirm("Hapus Petugas OSIS ini?")) return;
    setStatus({ type: "", text: "" });
    setBusy(true);
    try {
      const username = normalizeTatibUsername(usernameValue);
      if (!username || !getOwnedTatibRow(username)) {
        setStatus({ type: "error", text: "Petugas OSIS tidak ditemukan pada tenant Anda." });
        return;
      }
      await callPersonnelAdminApi("DELETE", {
        entity: "tatib",
        username,
        schoolId,
        schoolName,
        npsn,
      });
      setStatus({ type: "success", text: "Petugas OSIS berhasil dihapus." });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal menghapus: ${String(e?.message || e)}` });
    } finally {
      setBusy(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const handleClassCreate = async () => {
    setStatus({ type: "", text: "" });
    setBusy(true);
    try {
      if (!schoolId) {
        setStatus({ type: "error", text: "Profil admin belum memiliki schoolId. Hubungi admin pusat." });
        return;
      }
      const className = buildClassName(classCreateForm.className, selectedGrade);
      if (!className) {
        setStatus({ type: "error", text: "Nama kelas wajib diisi." });
        return;
      }
      if (!className.includes("-")) {
        setStatus({ type: "error", text: "Format kelas tidak valid. Contoh: VII-D" });
        return;
      }
      const grade = toGradeFromClass(className);
      if (grade !== selectedGrade) {
        setStatus({ type: "error", text: "Nama kelas harus sesuai dengan jenjang yang dipilih." });
        return;
      }
      const key = normalize(className).toUpperCase();
      if (classOptions.some((c) => normalize(c).toUpperCase() === key)) {
        setStatus({ type: "error", text: "Kelas ini sudah ada." });
        return;
      }
      await callStudentAdminApi("POST", {
        action: "class-create",
        className,
        grade: selectedGrade,
        schoolId,
        schoolName,
        npsn,
      });
      setClassCreateForm({ className: "" });
      setClassCreateOpen(false);
      setSelectedClass(className);
      setStatus({ type: "success", text: "Kelas berhasil ditambahkan." });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal menambahkan kelas: ${String(e?.message || e)}` });
    } finally {
      setBusy(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const openClassEdit = (className: string) => {
    setClassEditingName(className);
    setClassEditForm({ className });
    setClassEditOpen(true);
  };

  const handleClassDelete = async (className: string) => {
    setStatus({ type: "", text: "" });
    setBusy(true);
    try {
      if (!schoolId) {
        setStatus({ type: "error", text: "Profil admin belum memiliki schoolId. Hubungi admin pusat." });
        return;
      }
      const key = normalize(className).toUpperCase();
      const count = studentCountByClass.get(key) || 0;
      if (count > 0) {
        setStatus({ type: "error", text: `Tidak bisa hapus kelas ini karena masih ada ${count} siswa. Pindahkan siswa dulu.` });
        return;
      }
      if (!window.confirm(`Hapus kelas ${className}?`)) return;
      await callStudentAdminApi("DELETE", {
        action: "class-delete",
        className,
        schoolId,
        schoolName,
        npsn,
      });

      if (normalize(selectedClass).toUpperCase() === key) {
        const next = classOptions.find((c) => normalize(c).toUpperCase() !== key) || "";
        setSelectedClass(next);
      }
      setStatus({ type: "success", text: "Kelas berhasil dihapus." });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal menghapus kelas: ${String(e?.message || e)}` });
    } finally {
      setBusy(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const handleClassEditSave = async () => {
    setStatus({ type: "", text: "" });
    setBusy(true);
    try {
      if (!schoolId) {
        setStatus({ type: "error", text: "Profil admin belum memiliki schoolId. Hubungi admin pusat." });
        return;
      }
      const oldClassName = normalize(classEditingName);
      if (!oldClassName) {
        setStatus({ type: "error", text: "Kelas tidak valid." });
        return;
      }
      const newClassName = buildClassName(classEditForm.className, selectedGrade);
      if (!newClassName) {
        setStatus({ type: "error", text: "Nama kelas wajib diisi." });
        return;
      }
      if (!newClassName.includes("-")) {
        setStatus({ type: "error", text: "Format kelas tidak valid. Contoh: VII-D" });
        return;
      }
      const grade = toGradeFromClass(newClassName);
      if (grade !== selectedGrade) {
        setStatus({ type: "error", text: "Nama kelas harus sesuai dengan jenjang yang dipilih." });
        return;
      }

      const oldKey = normalize(oldClassName).toUpperCase();
      const newKey = normalize(newClassName).toUpperCase();
      if (oldKey === newKey) {
        setClassEditOpen(false);
        setClassEditingName("");
        setStatus({ type: "success", text: "Tidak ada perubahan." });
        return;
      }
      if (classOptions.some((c) => normalize(c).toUpperCase() === newKey)) {
        setStatus({ type: "error", text: "Nama kelas sudah digunakan." });
        return;
      }
      await callStudentAdminApi("PUT", {
        action: "class-update",
        previousClassName: oldClassName,
        className: newClassName,
        grade: selectedGrade,
        schoolId,
        schoolName,
        npsn,
      });
      setSelectedClass(newClassName);
      setClassEditOpen(false);
      setClassEditingName("");
      setClassEditForm({ className: "" });
      setStatus({ type: "success", text: "Kelas berhasil diperbarui." });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal menyimpan kelas: ${String(e?.message || e)}` });
    } finally {
      setBusy(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
    }
  };

  const downloadStudentImportTemplate = () => {
    const headers = ["NISN", "NAMA LENGKAP", "L/P", "Kelas"];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws["!cols"] = [{ wch: 18 }, { wch: 30 }, { wch: 6 }, { wch: 12 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Siswa");

    const bytes = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeSchool = normalize(schoolName).replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim();
    a.download = safeSchool ? `Template_Import_Siswa_${safeSchool}.xlsx` : "Template_Import_Siswa.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadPrincipalAccounts = () => {
    if (superPrincipals.length === 0) {
      setStatus({ type: "error", text: "Belum ada akun kepala sekolah untuk didownload." });
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
      return;
    }

    const rows = superPrincipals.map((p, index) => ({
      NO: index + 1,
      USERNAME: normalize(p.username),
      NAMA: normalize(p.name),
      SCHOOL_ID: normalize(p.schoolId),
      NAMA_SEKOLAH: normalize(p.schoolName),
      STATUS: p.isActive ? "Aktif" : "Nonaktif",
      DEVICE: p.deviceId ? "Terikat" : "Belum Terikat",
      LOGIN_TERAKHIR: formatDateTime(p.lastLoginAt || undefined),
      DIBUAT: formatDateTime(p.createdAt || undefined),
      DIPERBARUI: formatDateTime(p.updatedAt || undefined),
    }));

    const wsAccounts = XLSX.utils.json_to_sheet(rows);
    wsAccounts["!cols"] = [
      { wch: 8 },
      { wch: 24 },
      { wch: 28 },
      { wch: 20 },
      { wch: 34 },
      { wch: 14 },
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 },
    ];

    const infoRows = [
      ["KETERANGAN", "NILAI"],
      ["Jumlah akun", String(superPrincipals.length)],
      ["Diexport pada", new Date().toLocaleString("id-ID")],
      ["Catatan password", "Password asli tidak ikut diexport karena disimpan sebagai hash SHA-256."],
      ["Tindakan jika perlu bagikan ulang sandi", "Lakukan set/reset password dari panel admin sebelum dibagikan."],
    ];
    const wsInfo = XLSX.utils.aoa_to_sheet(infoRows);
    wsInfo["!cols"] = [{ wch: 34 }, { wch: 90 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsAccounts, "Akun Kepala Sekolah");
    XLSX.utils.book_append_sheet(wb, wsInfo, "Info");

    const bytes = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `Akun_Kepala_Sekolah_${stamp}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setStatus({ type: "success", text: `File akun kepala sekolah berhasil didownload (${superPrincipals.length} akun).` });
    setTimeout(() => setStatus({ type: "", text: "" }), 2500);
  };

  const regeneratePrincipalPasswordsAndDownload = async () => {
    if (superPrincipals.length === 0) {
      setStatus({ type: "error", text: "Belum ada akun kepala sekolah untuk diproses." });
      setTimeout(() => setStatus({ type: "", text: "" }), 2500);
      return;
    }
    if (
      !window.confirm(
        `Generate password baru untuk semua akun kepala sekolah (${superPrincipals.length} akun)? Password lama akan diganti.`
      )
    ) {
      return;
    }

    setPrincipalSaving(true);
    setStatus({ type: "", text: "" });
    try {
      const result = await callPrincipalAdminApi("POST", {
        action: "bulk-reset-passwords",
      });
      const now = Number(result?.data?.updatedAt || Date.now());
      const exportedRows = Array.isArray(result?.data?.exportedRows) ? result.data.exportedRows : [];

      const wsAccounts = XLSX.utils.json_to_sheet(exportedRows);
      wsAccounts["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 34 }, { wch: 20 }];

      const wsInfo = XLSX.utils.aoa_to_sheet([
        ["KETERANGAN", "NILAI"],
        ["Jumlah akun", String(exportedRows.length)],
        ["Diexport pada", new Date(now).toLocaleString("id-ID")],
        ["Catatan", "Password pada file ini adalah password baru yang baru saja digenerate oleh sistem."],
      ]);
      wsInfo["!cols"] = [{ wch: 24 }, { wch: 90 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsAccounts, "Password Baru Kepsek");
      XLSX.utils.book_append_sheet(wb, wsInfo, "Info");

      const bytes = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date(now).toISOString().slice(0, 10);
      a.href = url;
      a.download = `Password_Baru_Kepala_Sekolah_${stamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setStatus({ type: "success", text: `Password baru berhasil digenerate dan didownload (${exportedRows.length} akun).` });
    } catch (e: any) {
      setStatus({ type: "error", text: `Gagal generate password massal: ${String(e?.message || e)}` });
    } finally {
      setPrincipalSaving(false);
      setTimeout(() => setStatus({ type: "", text: "" }), 3000);
    }
  };

  const navigateSuperSection = (section: SuperDbSection) => {
    setSuperSection(section);
    router.replace(`/super-admin/database?sub=${section}`);
  };

  if (!mounted || !_hasHydrated || isEduLockAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(99,102,241,0.28),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(34,211,238,0.18),transparent_50%),radial-gradient(800px_circle_at_50%_85%,rgba(168,85,247,0.14),transparent_55%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-black" />
        </div>
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center p-6">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-6 py-4 text-sm font-semibold text-slate-200 shadow-xl backdrop-blur">
            Memuat...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || (user?.role !== "admin" && user?.role !== "super_admin")) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(99,102,241,0.28),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(34,211,238,0.18),transparent_50%),radial-gradient(800px_circle_at_50%_85%,rgba(168,85,247,0.14),transparent_55%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-black" />
        </div>
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center p-6">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-6 py-4 text-sm font-semibold text-slate-200 shadow-xl backdrop-blur">
            Mengalihkan sesi...
          </div>
        </div>
      </div>
    );
  }

  const isSuperAdminView = user?.role === "super_admin";

  if (isSuperAdminView) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 md:h-screen md:overflow-hidden">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_15%_10%,rgba(99,102,241,0.26),transparent_55%),radial-gradient(900px_circle_at_85%_15%,rgba(34,211,238,0.16),transparent_50%),radial-gradient(800px_circle_at_50%_90%,rgba(168,85,247,0.12),transparent_55%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-black" />
        </div>

        <div className="h-full w-full px-4 py-5 sm:px-5 xl:px-6">
          <main className="min-w-0 space-y-5 xl:space-y-6 md:flex md:h-full md:flex-col md:overflow-hidden">
            <div className="grid items-start gap-5 md:h-full md:grid-cols-[196px_minmax(0,1fr)] md:gap-5">
              <aside className="min-w-0 md:self-start md:overflow-hidden">
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl backdrop-blur md:max-h-[calc(100vh-2.5rem)] md:overflow-y-auto">
                  <div className="border-b border-white/10 px-4 py-4">
                    <div className="text-sm font-semibold text-slate-200">Database Induk</div>
                    <div className="mt-1 text-xs text-slate-400">Mode Super Admin (lintas sekolah)</div>
                  </div>
                  <div className="p-2">
                    {SUPER_ADMIN_DATABASE_MENU.map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => navigateSuperSection(id)}
                        className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                          superSection === id
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20"
                            : "text-slate-200 hover:bg-white/5"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </aside>

            <div className="min-w-0 space-y-5 xl:space-y-6 md:h-full md:overflow-y-auto md:pr-1">
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl backdrop-blur sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Database Induk</div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Data Induk — Super Admin</h1>
                    <p className="mt-1 text-sm text-slate-300">
                      Pusat registrasi sekolah, admin sekolah, kepala sekolah, dan monitoring layanan lintas sekolah.
                    </p>
                  </div>
                  <Link
                    href="/admin"
                    className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
                  >
                    Kembali ke Dashboard Satu Pintu
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl backdrop-blur sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">Workflow Super Admin</div>
                    <div className="mt-1 text-sm text-slate-300">
                      Alur kerja standar: (1) daftarkan sekolah → (2) buka akun admin sekolah → (3) buat akun kepala sekolah → (4) monitor layanan.
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    Step aktif:{" "}
                    {superSection === "schools"
                      ? "1"
                      : superSection === "admins"
                        ? "2"
                        : superSection === "principals"
                          ? "3"
                          : superSection === "monitoring"
                            ? "4"
                          : "-"}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => navigateSuperSection("schools")}
                    className={`flex items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                      superSection === "schools"
                        ? "border-indigo-400/30 bg-indigo-500/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-sm font-extrabold text-slate-100 ring-1 ring-white/10">
                      1
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">Sekolah & Tenant</div>
                      <div className="mt-1 text-xs text-slate-300">
                        Daftarkan tenant, NPSN, identitas sekolah, dan status operasional sekolah.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateSuperSection("admins")}
                    className={`flex items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                      superSection === "admins"
                        ? "border-indigo-400/30 bg-indigo-500/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-sm font-extrabold text-slate-100 ring-1 ring-white/10">
                      2
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">Admin Sekolah</div>
                      <div className="mt-1 text-xs text-slate-300">
                        Atur login admin sekolah, buka/tutup akses, dan reset password admin.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateSuperSection("principals")}
                    className={`flex items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                      superSection === "principals"
                        ? "border-indigo-400/30 bg-indigo-500/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-sm font-extrabold text-slate-100 ring-1 ring-white/10">
                      3
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">Kepala Sekolah</div>
                      <div className="mt-1 text-xs text-slate-300">
                        Buat, ubah, reset, dan nonaktifkan akun kepala sekolah per sekolah.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateSuperSection("monitoring")}
                    className={`flex items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                      superSection === "monitoring"
                        ? "border-indigo-400/30 bg-indigo-500/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-sm font-extrabold text-slate-100 ring-1 ring-white/10">
                      4
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">Monitoring</div>
                      <div className="mt-1 text-xs text-slate-300">
                        Pantau gap admin, gap kepala sekolah, dan log layanan lintas sekolah.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

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
                  <div className="text-xs font-semibold tracking-widest text-slate-400">TENANTS</div>
                  <div className="mt-1 text-2xl font-bold text-white">{superStats.tenantsTotal}</div>
                  <div className="mt-1 text-sm text-slate-300">Total sekolah</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-xl backdrop-blur">
                  <div className="text-xs font-semibold tracking-widest text-slate-400">ADMIN SEKOLAH</div>
                  <div className="mt-1 text-2xl font-bold text-white">{superStats.adminsActive}</div>
                  <div className="mt-1 text-sm text-slate-300">Akses admin sekolah aktif</div>
                  <div className="mt-1 text-xs text-slate-400">Belum ada admin: {superStats.tenantsMissingAdmin}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-xl backdrop-blur">
                  <div className="text-xs font-semibold tracking-widest text-slate-400">KEPALA SEKOLAH</div>
                  <div className="mt-1 text-2xl font-bold text-white">{superStats.principalsActive}</div>
                  <div className="mt-1 text-sm text-slate-300">
                    Akun kepala sekolah aktif
                  </div>
                  <div className="mt-1 text-xs text-slate-400">Belum ada kepala sekolah: {superStats.schoolsMissingPrincipal}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-xl backdrop-blur">
                  <div className="text-xs font-semibold tracking-widest text-slate-400">MONITORING</div>
                  <div className="mt-1 text-2xl font-bold text-white">{superStats.tenantsLive}</div>
                  <div className="mt-1 text-sm text-slate-300">Tenant sudah live</div>
                  <div className="mt-1 text-xs text-slate-400">Log pelanggaran terbaru: {superStats.violationsRecent}</div>
                </div>
              </div>

              {superSection === "schools" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl backdrop-blur">
                    <div className="text-sm font-semibold text-white">Tambah / Update Sekolah</div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold tracking-widest text-slate-400">SCHOOL ID</label>
                        <input
                          value={superSchoolForm.schoolId}
                          onChange={(e) => setSuperSchoolForm((s) => ({ ...s, schoolId: e.target.value }))}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                          placeholder="contoh: smpn_3_pacet"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold tracking-widest text-slate-400">NAMA</label>
                        <input
                          value={superSchoolForm.name}
                          onChange={(e) => setSuperSchoolForm((s) => ({ ...s, name: e.target.value }))}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                          placeholder="SMPN 3 PACET"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold tracking-widest text-slate-400">KECAMATAN</label>
                        <input
                          value={superSchoolForm.district}
                          onChange={(e) => setSuperSchoolForm((s) => ({ ...s, district: e.target.value }))}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                          placeholder="Pacet"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold tracking-widest text-slate-400">NPSN</label>
                        <input
                          value={superSchoolForm.npsn}
                          onChange={(e) => setSuperSchoolForm((s) => ({ ...s, npsn: e.target.value }))}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                          placeholder="20555784"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold tracking-widest text-slate-400">EMAIL KONTAK LOGIN</label>
                        <input
                          value={superSchoolForm.authEmail}
                          onChange={(e) => setSuperSchoolForm((s) => ({ ...s, authEmail: e.target.value }))}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                          placeholder="email kontak login sekolah"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold tracking-widest text-slate-400">EMAIL KONTAK ADMIN</label>
                        <input
                          value={superSchoolForm.adminEmail}
                          onChange={(e) => setSuperSchoolForm((s) => ({ ...s, adminEmail: e.target.value }))}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                          placeholder="admin@sekolah.id"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold tracking-widest text-slate-400">EMAIL BACKUP</label>
                        <input
                          value={superSchoolForm.backupEmail}
                          onChange={(e) => setSuperSchoolForm((s) => ({ ...s, backupEmail: e.target.value }))}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                          placeholder="email backup"
                        />
                      </div>
                      <div className="flex items-center gap-2 sm:mt-7">
                        <input
                          id="schoolActiveSuper"
                          type="checkbox"
                          checked={superSchoolForm.isActive}
                          onChange={(e) => setSuperSchoolForm((s) => ({ ...s, isActive: e.target.checked }))}
                        />
                        <label htmlFor="schoolActiveSuper" className="text-sm text-slate-200">
                          Tenant dibuka
                        </label>
                      </div>
                    </div>
                    <div className="mt-4">
                      <button
                        type="button"
                        disabled={superSaving}
                        onClick={saveSuperSchool}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600/90 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 hover:bg-indigo-600 disabled:opacity-60"
                      >
                        Simpan
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl backdrop-blur overflow-hidden">
                    <div className="border-b border-white/10 p-4">
                      <div className="text-sm font-semibold text-white">Daftar Sekolah ({superSchools.length})</div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-white/10 text-sm">
                        <thead className="bg-white/5">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">SEKOLAH</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">NPSN</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">REGISTRY</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">OPERASIONAL</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">RELASI AKUN</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">UPDATED</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold tracking-widest text-slate-300">AKSI</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {superSchools.map((s) => (
                            <tr key={s.schoolId} className="hover:bg-white/5">
                              <td className="px-4 py-3">
                                <div className="font-semibold text-white">{s.name || "-"}</div>
                                <div className="text-xs text-slate-400">{s.schoolId}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-200">{s.npsn || "-"}</td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-700/80 text-slate-100 ring-1 ring-slate-500/30">
                                  Terdaftar
                                </span>
                                <span
                                  className={`ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                    s.isActive ? "bg-cyan-500/10 text-cyan-100 ring-1 ring-cyan-400/20" : "bg-amber-500/10 text-amber-100 ring-1 ring-amber-400/20"
                                  }`}
                                >
                                  {s.isActive ? "Tenant Dibuka" : "Tenant Ditutup"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {(() => {
                                  const adminRow = schoolAdminRowBySchoolId.get(normalize(s.schoolId).toLowerCase());
                                  const ready = adminRow ? Boolean(adminRow.loginIdentifier) : false;
                                  const live = hasOperationalRuntime(adminRow);
                                  return (
                                    <>
                                      <span
                                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                          ready
                                            ? "bg-emerald-500/10 text-emerald-100 ring-1 ring-emerald-400/20"
                                            : "bg-yellow-500/10 text-yellow-100 ring-1 ring-yellow-400/20"
                                        }`}
                                      >
                                        {ready ? "Login Dibuka" : "Login Belum Siap"}
                                      </span>
                                      <span
                                        className={`ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                          live
                                            ? "bg-cyan-500/10 text-cyan-100 ring-1 ring-cyan-400/20"
                                            : "bg-slate-700/80 text-slate-100 ring-1 ring-slate-500/30"
                                        }`}
                                      >
                                        {live ? "Live" : "Belum Live"}
                                      </span>
                                    </>
                                  );
                                })()}
                              </td>
                              <td className="px-4 py-3">
                                {(() => {
                                  const adminRow = schoolAdminRowBySchoolId.get(normalize(s.schoolId).toLowerCase());
                                  const principalRow = principalBySchoolId.get(normalize(s.schoolId).toLowerCase());
                                  return (
                                    <div className="space-y-1.5">
                                      <div className="text-xs text-slate-200">
                                        <span className="font-semibold text-slate-100">Tenant:</span>{" "}
                                        {s.isActive ? "dibuka" : "ditutup"} / {s.adminAccessActive !== false ? "login admin dibuka" : "login admin ditutup"}
                                      </div>
                                      <div className="text-xs text-slate-200">
                                        <span className="font-semibold text-slate-100">Admin Web:</span>{" "}
                                        {adminRow?.loginIdentifier || "belum dikonfigurasi"}
                                      </div>
                                      <div className="text-xs text-slate-200">
                                        <span className="font-semibold text-slate-100">Runtime:</span>{" "}
                                        {adminRow?.runtimeEmail || "belum ada akun runtime"}
                                      </div>
                                      <div className="text-xs text-slate-200">
                                        <span className="font-semibold text-slate-100">Kepsek:</span>{" "}
                                        {principalRow?.name || principalRow?.username || "belum dibuat"}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="px-4 py-3 text-slate-200">{formatDateTime(s.updatedAt || undefined)}</td>
                              <td className="px-4 py-3 text-right space-x-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSuperSchoolForm({
                                      schoolId: s.schoolId,
                                      name: s.name,
                                      district: s.district,
                                      npsn: s.npsn,
                                      authEmail: s.authEmail,
                                      adminEmail: s.adminEmail,
                                      backupEmail: s.backupEmail,
                                      isActive: s.isActive,
                                    })
                                  }
                                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openAdminSchoolEditor(s, schoolAdminRowBySchoolId.get(normalize(s.schoolId).toLowerCase()))}
                                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
                                >
                                  Atur Admin
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPrincipalEditing("");
                                    setPrincipalForm({
                                      username: "",
                                      name: "",
                                      schoolId: s.schoolId,
                                      schoolName: s.name,
                                      password: "",
                                      isActive: true,
                                    });
                                    navigateSuperSection("principals");
                                  }}
                                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
                                >
                                  Atur Kepsek
                                </button>
                                <button
                                  type="button"
                                  disabled={superSaving}
                                  onClick={() => toggleSuperSchoolActive(s.schoolId, !s.isActive)}
                                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                                >
                                  {s.isActive ? "Tutup Tenant" : "Buka Tenant"}
                                </button>
                              </td>
                            </tr>
                          ))}
                          {superSchools.length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
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

              {superSection === "admins" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl backdrop-blur">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">Create / Edit Login Admin Sekolah</div>
                        <div className="mt-1 text-sm text-slate-300">
                          Menu ini mengatur akun login admin seluruh sekolah untuk akses web PortalKita, bukan user internal sekolah.
                        </div>
                        <div className="mt-2 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                          {adminSchoolEditing ? "Mode: edit registry login sekolah" : "Mode: pilih sekolah lalu konfigurasi login"}
                        </div>
                      </div>
                      {adminSchoolEditing && (
                        <button
                          type="button"
                          onClick={resetAdminSchoolForm}
                          className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
                        >
                          Batal Edit
                        </button>
                      )}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold tracking-widest text-slate-400">SEKOLAH</label>
                        <select
                          value={adminSchoolForm.schoolId}
                          onChange={(e) => {
                            const next = e.target.value;
                            const school = superSchools.find((s) => s.schoolId === next);
                            if (!school) {
                              resetAdminSchoolForm();
                              return;
                            }
                            openAdminSchoolEditor(school, schoolAdminRowBySchoolId.get(normalize(school.schoolId).toLowerCase()));
                          }}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
                        >
                          <option value="">Pilih sekolah</option>
                          {superSchools.map((s) => (
                            <option key={s.schoolId} value={s.schoolId}>
                              {s.name || s.schoolId}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold tracking-widest text-slate-400">NPSN</label>
                        <input
                          value={adminSchoolForm.npsn}
                          onChange={(e) => setAdminSchoolForm((s) => ({ ...s, npsn: e.target.value }))}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                          placeholder="NPSN sekolah"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold tracking-widest text-slate-400">EMAIL KONTAK LOGIN</label>
                        <input
                          value={adminSchoolForm.authEmail}
                          onChange={(e) => setAdminSchoolForm((s) => ({ ...s, authEmail: e.target.value }))}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                          placeholder="20555784@edulock.local / email valid"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold tracking-widest text-slate-400">EMAIL KONTAK ADMIN</label>
                        <input
                          value={adminSchoolForm.adminEmail}
                          onChange={(e) => setAdminSchoolForm((s) => ({ ...s, adminEmail: e.target.value }))}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                          placeholder="admin@sekolah.id"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold tracking-widest text-slate-400">EMAIL BACKUP</label>
                        <input
                          value={adminSchoolForm.backupEmail}
                          onChange={(e) => setAdminSchoolForm((s) => ({ ...s, backupEmail: e.target.value }))}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                          placeholder="email backup admin sekolah"
                        />
                      </div>
                      <div className="flex items-center gap-2 sm:mt-7">
                        <input
                          id="adminSchoolTenantActive"
                          type="checkbox"
                          checked={adminSchoolForm.schoolActive}
                          onChange={(e) => setAdminSchoolForm((s) => ({ ...s, schoolActive: e.target.checked }))}
                        />
                        <label htmlFor="adminSchoolTenantActive" className="text-sm text-slate-200">
                          Tenant dibuka
                        </label>
                      </div>
                      <div className="flex items-center gap-2 sm:mt-7">
                        <input
                          id="adminSchoolAccessActive"
                          type="checkbox"
                          checked={adminSchoolForm.adminAccessActive}
                          onChange={(e) => setAdminSchoolForm((s) => ({ ...s, adminAccessActive: e.target.checked }))}
                        />
                        <label htmlFor="adminSchoolAccessActive" className="text-sm text-slate-200">
                          Login admin dibuka
                        </label>
                      </div>
                    </div>

                    {adminSchoolForm.schoolId && (
                      <div className="mt-4 grid gap-3 lg:grid-cols-4">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-xs font-semibold tracking-widest text-slate-400">RELASI TENANT</div>
                          <div className="mt-2 text-sm text-slate-100">{adminSchoolForm.schoolName || adminSchoolForm.schoolId}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            School ID: {adminSchoolForm.schoolId} • NPSN: {adminSchoolForm.npsn || "-"}
                          </div>
                          <div className="mt-2 text-xs text-slate-300">
                            Status tenant: {adminSchoolForm.schoolActive ? "dibuka" : "ditutup"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-xs font-semibold tracking-widest text-slate-400">REGISTRY LOGIN WEB</div>
                          <div className="mt-2 text-sm text-slate-100">Username: {adminSchoolForm.npsn || "-"}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            Password default: admin123
                          </div>
                          <div className="mt-2 text-xs text-slate-300">
                            Akses login: {adminSchoolForm.adminAccessActive ? "dibuka" : "ditutup"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-xs font-semibold tracking-widest text-slate-400">RUNTIME ADMIN</div>
                          {(() => {
                            const row = schoolAdminRowBySchoolId.get(normalize(adminSchoolForm.schoolId).toLowerCase());
                            return (
                              <>
                                <div className="mt-2 text-sm text-slate-100">{row?.runtimeEmail || "belum ada akun runtime"}</div>
                                <div className="mt-1 text-xs text-slate-400">
                                  {hasOperationalRuntime(row)
                                    ? `Terakhir login: ${formatDateTime(row?.runtimeLastLoginAt || undefined)}`
                                    : "Belum pernah live di tenant ini"}
                                </div>
                                <div className="mt-2 text-xs text-slate-300">
                                  Status runtime: {row?.runtimeUid ? "akun runtime terhubung" : "akun runtime belum terbentuk"}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-xs font-semibold tracking-widest text-slate-400">RELASI KEPSEK</div>
                          {(() => {
                            const principal = principalBySchoolId.get(normalize(adminSchoolForm.schoolId).toLowerCase());
                            return (
                              <>
                                <div className="mt-2 text-sm text-slate-100">{principal?.name || principal?.username || "belum dibuat"}</div>
                                <div className="mt-1 text-xs text-slate-400">
                                  {principal
                                    ? `Status: ${principal.isActive ? "aktif" : "nonaktif"}`
                                    : "Buat akun kepala sekolah di submenu Kepsek"}
                                </div>
                                <div className="mt-2 text-xs text-slate-300">
                                  Relasi sekolah: {adminSchoolForm.schoolName || adminSchoolForm.schoolId}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={superSaving || !adminSchoolForm.schoolId}
                        onClick={saveAdminSchoolRegistry}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600/90 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 hover:bg-indigo-600 disabled:opacity-60"
                      >
                        Simpan Login Admin
                      </button>
                      <button
                        type="button"
                        disabled={superSaving || !adminSchoolForm.schoolId}
                        onClick={() => bootstrapSchoolAdminLogin(adminSchoolForm)}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                      >
                        Bootstrap Login Default
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      `Simpan Login Admin` memperbarui registry sekolah sekaligus menyelaraskan status buka/tutup login admin. `Bootstrap Login Default` membuat atau menyelaraskan akun runtime admin dengan username `NPSN` dan password awal `admin123`.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl backdrop-blur overflow-hidden">
                    <div className="border-b border-white/10 p-4">
                      <div className="text-sm font-semibold text-white">Daftar Admin Sekolah ({superSchoolAdmins.length})</div>
                      <div className="mt-1 text-xs text-slate-400">
                        Relasi tenant, akun login admin web, dan akun kepala sekolah ditampilkan bersama agar status tiap sekolah lebih eksplisit.
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-white/10 text-sm">
                        <thead className="bg-white/5">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">LOGIN ADMIN</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">SEKOLAH</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">RELASI</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">LOGIN TERAKHIR</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">STATUS</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold tracking-widest text-slate-300">AKSI</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {superSchoolAdmins.map((a) => {
                            const principal = principalBySchoolId.get(normalize(a.schoolId).toLowerCase());
                            return (
                              <tr key={a.schoolId} className="hover:bg-white/5">
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-white">{a.loginIdentifier || "-"}</div>
                                  <div className="text-xs text-slate-400">
                                    {a.npsn
                                      ? `Password default: admin123`
                                      : "Lengkapi NPSN sekolah"}
                                  </div>
                                  {a.runtimeEmail && a.runtimeEmail !== a.loginIdentifier && (
                                    <div className="text-xs text-slate-500">Runtime: {a.runtimeEmail}</div>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="text-slate-200">{a.schoolName || "-"}</div>
                                  <div className="text-xs text-slate-400">{a.schoolId || ""}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="text-xs text-slate-200">
                                    <span className="font-semibold text-slate-100">Tenant:</span> {a.schoolActive ? "dibuka" : "ditutup"}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-200">
                                    <span className="font-semibold text-slate-100">Registry:</span> {a.loginIdentifier || "belum dikonfigurasi"}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-200">
                                    <span className="font-semibold text-slate-100">Kepsek:</span> {principal?.name || principal?.username || "belum dibuat"}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-slate-200">{formatDateTime(a.runtimeLastLoginAt || undefined)}</td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                      a.accessActive && a.schoolActive
                                        ? "bg-emerald-500/10 text-emerald-100 ring-1 ring-emerald-400/20"
                                        : "bg-red-500/10 text-red-100 ring-1 ring-red-400/20"
                                    }`}
                                  >
                                    {a.accessActive && a.schoolActive ? "Login Dibuka" : "Login Ditutup"}
                                  </span>
                                  {!a.schoolActive && (
                                    <span className="ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-700/80 text-slate-100 ring-1 ring-slate-500/30">
                                      Tenant Ditutup
                                    </span>
                                  )}
                                  {hasOperationalRuntime(a) ? (
                                    <span className="ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-cyan-500/10 text-cyan-100 ring-1 ring-cyan-400/20">
                                      Live
                                    </span>
                                  ) : (
                                    <span className="ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-700/80 text-slate-100 ring-1 ring-slate-500/30">
                                      Belum Live
                                    </span>
                                  )}
                                  {a.runtimeMustChangePassword && (
                                    <span className="ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-yellow-500/10 text-yellow-100 ring-1 ring-yellow-400/20">
                                      Wajib ganti
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const school = superSchools.find((s) => normalize(s.schoolId).toLowerCase() === normalize(a.schoolId).toLowerCase());
                                      if (school) openAdminSchoolEditor(school, a);
                                    }}
                                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
                                  >
                                    Edit Login
                                  </button>
                                  <button
                                    type="button"
                                    disabled={superSaving}
                                    onClick={() => bootstrapSchoolAdminLogin(a)}
                                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                                  >
                                    Bootstrap
                                  </button>
                                  <button
                                    type="button"
                                    disabled={superSaving}
                                    onClick={() => toggleSchoolAdminAccess(a, !a.accessActive)}
                                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                                  >
                                    {a.accessActive ? "Tutup Login" : "Buka Login"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={superSaving}
                                    onClick={() => resetSchoolAdminPassword(a)}
                                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                                  >
                                    Reset Default
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {superSchoolAdmins.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                                Belum ada data admin.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {superSection === "principals" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl backdrop-blur">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">Tambah / Update Akun Kepala Sekolah</div>
                        <div className="mt-1 text-sm text-slate-300">
                          Akun ini dipakai untuk login APK Kepala Sekolah. Scope data terkunci lewat schoolId.
                        </div>
                      </div>
                      {principalEditing && (
                        <button
                          type="button"
                          onClick={() => {
                            setPrincipalEditing("");
                            setPrincipalForm({ username: "", name: "", schoolId: "", schoolName: "", password: "", isActive: true });
                          }}
                          className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
                        >
                          Batal Edit
                        </button>
                      )}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold tracking-widest text-slate-400">USERNAME</label>
                        <input
                          value={principalForm.username}
                          disabled={!!principalEditing}
                          onChange={(e) => setPrincipalForm((s) => ({ ...s, username: e.target.value }))}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400 disabled:opacity-60"
                          placeholder="contoh: kepsek_smpn3pacet"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold tracking-widest text-slate-400">NAMA</label>
                        <input
                          value={principalForm.name}
                          onChange={(e) => setPrincipalForm((s) => ({ ...s, name: e.target.value }))}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                          placeholder="Nama Kepala Sekolah"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold tracking-widest text-slate-400">SCHOOL ID</label>
                        <select
                          value={principalForm.schoolId}
                          onChange={(e) => {
                            const next = e.target.value;
                            const school = superSchools.find((s) => s.schoolId === next);
                            setPrincipalForm((s) => ({ ...s, schoolId: next, schoolName: s.schoolName || school?.name || "" }));
                          }}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
                        >
                          <option value="">Pilih sekolah</option>
                          {superSchools.map((s) => (
                            <option key={s.schoolId} value={s.schoolId}>
                              {s.name || s.schoolId}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold tracking-widest text-slate-400">SCHOOL NAME</label>
                        <input
                          value={principalForm.schoolName}
                          onChange={(e) => setPrincipalForm((s) => ({ ...s, schoolName: e.target.value }))}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                          placeholder="Nama sekolah (otomatis dari registry)"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold tracking-widest text-slate-400">PASSWORD / NIP</label>
                        <input
                          value={principalForm.password}
                          onChange={(e) => setPrincipalForm((s) => ({ ...s, password: e.target.value }))}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                          placeholder={principalEditing ? "Kosongkan jika tidak diubah" : "Wajib untuk akun baru"}
                        />
                        <div className="mt-1 text-xs text-slate-400">Disimpan sebagai hash (SHA-256), bukan plaintext.</div>
                      </div>
                      <div className="flex items-center gap-2 sm:mt-7">
                        <input
                          id="principalActive"
                          type="checkbox"
                          checked={principalForm.isActive}
                          onChange={(e) => setPrincipalForm((s) => ({ ...s, isActive: e.target.checked }))}
                        />
                        <label htmlFor="principalActive" className="text-sm text-slate-200">
                          Akun aktif
                        </label>
                      </div>
                    </div>

                    <div className="mt-4">
                      <button
                        type="button"
                        disabled={principalSaving}
                        onClick={upsertPrincipalAccount}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600/90 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 hover:bg-indigo-600 disabled:opacity-60"
                      >
                        Simpan
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl backdrop-blur overflow-hidden">
                    <div className="border-b border-white/10 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm font-semibold text-white">Akun Kepala Sekolah ({filteredSuperPrincipals.length})</div>
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                          <button
                            type="button"
                            onClick={regeneratePrincipalPasswordsAndDownload}
                            disabled={principalSaving || superPrincipals.length === 0}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm ring-1 ring-white/10 hover:bg-amber-400 disabled:opacity-60"
                          >
                            <Lock className="h-4 w-4" />
                            Generate Password Baru + Download
                          </button>
                          <button
                            type="button"
                            onClick={downloadPrincipalAccounts}
                            disabled={principalSaving || superPrincipals.length === 0}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 shadow-sm backdrop-blur hover:bg-white/10 disabled:opacity-60"
                          >
                            <Download className="h-4 w-4" />
                            Download Semua Akun
                          </button>
                          <div className="relative w-full sm:w-96">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                              value={principalQuery}
                              onChange={(e) => setPrincipalQuery(e.target.value)}
                              className="w-full rounded-xl border border-white/10 bg-slate-800 pl-10 pr-3 py-2 text-sm text-white placeholder:text-slate-400"
                              placeholder="Cari username / nama / sekolah"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-slate-400">
                        Tombol kuning akan mengganti password lama semua akun dan mengunduh file Excel password baru. Tombol download biasa hanya mengunduh data akun tanpa password.
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-white/10 text-sm">
                        <thead className="bg-white/5">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">AKUN</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">SEKOLAH</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">LOGIN TERAKHIR</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">DEVICE</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-300">STATUS</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold tracking-widest text-slate-300">AKSI</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {filteredSuperPrincipals.map((p) => (
                            <tr key={p.username} className="hover:bg-white/5">
                              <td className="px-4 py-3">
                                <div className="font-semibold text-white">{p.username}</div>
                                <div className="text-xs text-slate-400">{p.name || "-"}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-slate-200">{p.schoolName || "-"}</div>
                                <div className="text-xs text-slate-400">{p.schoolId || ""}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-200">{formatDateTime(p.lastLoginAt || undefined)}</td>
                              <td className="px-4 py-3 text-slate-200">{p.deviceId ? "Terikat" : "-"}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                    p.isActive ? "bg-emerald-500/10 text-emerald-100 ring-1 ring-emerald-400/20" : "bg-red-500/10 text-red-100 ring-1 ring-red-400/20"
                                  }`}
                                >
                                  {p.isActive ? "Aktif" : "Nonaktif"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right space-x-2">
                                <button
                                  type="button"
                                  onClick={() => startEditPrincipal(p)}
                                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  disabled={principalSaving || !p.deviceId}
                                  onClick={() => resetPrincipalDevice(p.username)}
                                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                                >
                                  Reset Device
                                </button>
                                <button
                                  type="button"
                                  disabled={principalSaving}
                                  onClick={() => togglePrincipalActive(p.username, !p.isActive)}
                                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                                >
                                  {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                                </button>
                                <button
                                  type="button"
                                  disabled={principalSaving}
                                  onClick={() => deletePrincipalAccount(p.username)}
                                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-white/10 disabled:opacity-60"
                                >
                                  Hapus
                                </button>
                              </td>
                            </tr>
                          ))}
                          {filteredSuperPrincipals.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                                Belum ada akun kepala sekolah.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {superSection === "monitoring" && (
                <div className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl backdrop-blur">
                      <div className="text-sm font-semibold text-white">Gap Data Induk</div>
                      <div className="mt-3 space-y-3 text-sm text-slate-200">
                        <div>
                          <span className="font-semibold text-slate-100">Sekolah tanpa admin:</span>{" "}
                          {schoolsWithoutAdmin.length > 0
                            ? schoolsWithoutAdmin.slice(0, 8).map((row) => row.schoolName || row.schoolId).join(", ")
                            : "semua sekolah sudah punya identitas login admin"}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-100">Sekolah tanpa kepala sekolah:</span>{" "}
                          {schoolsWithoutPrincipal.length > 0
                            ? schoolsWithoutPrincipal.slice(0, 8).map((row) => row.name || row.schoolId).join(", ")
                            : "semua sekolah sudah punya akun kepala sekolah"}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-100">Tenant belum live:</span>{" "}
                          {superStats.tenantsTotal - superStats.tenantsLive > 0
                            ? `${superStats.tenantsTotal - superStats.tenantsLive} sekolah belum pernah login`
                            : "semua tenant sudah pernah aktif login"}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl backdrop-blur">
                      <div className="text-sm font-semibold text-white">Ringkasan Layanan</div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-xs font-semibold tracking-widest text-slate-400">TENANT DIBUKA</div>
                          <div className="mt-1 text-xl font-bold text-white">{superStats.tenantsEnabled}</div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-xs font-semibold tracking-widest text-slate-400">ADMIN TERPROVISI</div>
                          <div className="mt-1 text-xl font-bold text-white">{superStats.tenantsWithAdmin}</div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-xs font-semibold tracking-widest text-slate-400">KEPSEK TERDAFTAR</div>
                          <div className="mt-1 text-xl font-bold text-white">{superStats.principalsTotal}</div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-xs font-semibold tracking-widest text-slate-400">VIOLATION LOG</div>
                          <div className="mt-1 text-xl font-bold text-white">{superStats.violationsRecent}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl backdrop-blur overflow-hidden">
                    <div className="border-b border-white/10 p-4">
                      <div className="text-sm font-semibold text-white">Log Pelanggaran Terbaru (200 data)</div>
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
                          {superViolations.map((l) => (
                            <tr key={l.id} className="hover:bg-white/5">
                              <td className="px-4 py-3 text-slate-200">{formatDateTime(l.timestamp || undefined)}</td>
                              <td className="px-4 py-3 font-semibold text-white">{l.nisn || "-"}</td>
                              <td className="px-4 py-3 text-slate-200">{l.type || "-"}</td>
                              <td className="px-4 py-3 text-slate-200">{l.description || "-"}</td>
                            </tr>
                          ))}
                          {superViolations.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                                Belum ada log pelanggaran.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const headerTitle =
    activeSub === "teachers"
      ? "Manajemen Wali Kelas"
      : activeSub === "staff"
        ? "Manajemen Petugas OSIS"
        : activeSub === "classes"
          ? "Manajemen Kelas"
          : "Manajemen Siswa";
  const headerSubtitle =
    activeSub === "teachers"
      ? "Kelola data guru dan wali kelas"
      : activeSub === "staff"
        ? "Siswa yang didaftarkan sebagai Petugas OSIS akan mendapat menu tambahan di EduLock"
        : activeSub === "classes"
          ? `Kelola kelas paralel ${schoolName ? `${schoolName}` : ""} (Terhubung ke Database)`
          : `Kelola data siswa ${schoolName ? `${schoolName}` : ""} (Terhubung ke Database)`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 lg:h-screen lg:overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_15%_10%,rgba(99,102,241,0.26),transparent_55%),radial-gradient(900px_circle_at_85%_15%,rgba(34,211,238,0.16),transparent_50%),radial-gradient(800px_circle_at_50%_90%,rgba(168,85,247,0.12),transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-black" />
      </div>
      <div className="h-full w-full px-4 py-5 sm:px-5 xl:px-6">
        <main className="min-w-0 space-y-6 lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">{headerTitle}</h1>
              <p className="mt-1 text-slate-300">{headerSubtitle}</p>
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-300">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                Terakhir disinkronisasi: <span className="text-slate-200">{formatDateTime(lastSyncAt)}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              {activeSub === "students" && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setLastSyncAt(Date.now());
                      setStatus({ type: "success", text: "Data dimuat ulang." });
                      setTimeout(() => setStatus({ type: "", text: "" }), 1500);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600/90 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 hover:bg-indigo-600 disabled:opacity-60"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Muat Ulang Data
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (!schoolId) {
                        setStatus({ type: "error", text: "Profil admin belum memiliki schoolId. Hubungi admin pusat." });
                        return;
                      }
                      if (!window.confirm("Hapus semua data siswa untuk sekolah ini?")) return;
                      setBusy(true);
                      setStatus({ type: "", text: "" });
                      try {
                        const result = await callStudentAdminApi("DELETE", {
                          action: "delete-all",
                          schoolId,
                          schoolName,
                          npsn,
                        });
                        const count = Number(result?.data?.count || 0);
                        setStatus({
                          type: "success",
                          text: count > 0 ? `Semua data siswa berhasil dihapus. Total ${count} siswa.` : "Tidak ada data siswa untuk dihapus.",
                        });
                      } catch (e: any) {
                        setStatus({ type: "error", text: `Gagal menghapus semua: ${String(e?.message || e)}` });
                      } finally {
                        setBusy(false);
                        setTimeout(() => setStatus({ type: "", text: "" }), 2500);
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600/90 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 hover:bg-red-600 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    Hapus Semua
                  </button>

                  {selectedGrade === 9 && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={deleteSelectedGradeStudents}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 shadow-sm ring-1 ring-red-400/20 hover:bg-red-500/15 disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                      Hapus Jenjang 9
                    </button>
                  )}

                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-600/90 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 hover:bg-emerald-600">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.currentTarget.value = "";
                        if (!file) return;
                        if (!schoolId) {
                          setStatus({ type: "error", text: "Profil admin belum memiliki schoolId. Hubungi admin pusat." });
                          return;
                        }
                        setBusy(true);
                        setStatus({ type: "", text: "" });
                        try {
                          const buf = await file.arrayBuffer();
                          const workbook = XLSX.read(buf, { type: "array" });
                          const sheet = workbook.Sheets[workbook.SheetNames[0]];
                          const rowsX: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
                          const payloadRows: StudentMutationApiPayload["rows"] = [];
                          for (const r of rowsX) {
                            const nisnValue = normalize(r.NISN || r.nisn || r.Nisn);
                            const nameValue = normalize(r["NAMA LENGKAP"] || r.Nama || r.NAMA || r.name || r.Nama_Lengkap);
                            const classValue = normalize(r.Kelas || r.KELAS || r.class);
                            const genderValue = String(r["L/P"] || r.LP || r.Gender || r.gender || "").trim().toUpperCase();
                            const gender = genderValue === "P" ? "P" : genderValue === "L" ? "L" : "";
                            if (!nisnValue || !nameValue || !classValue) {
                              continue;
                            }
                            if (!allowedStudentClassSet.has(normalize(classValue).toUpperCase())) {
                              continue;
                            }
                            payloadRows.push({
                              nisn: nisnValue,
                              name: nameValue,
                              className: classValue,
                              gender,
                              status: "Aktif",
                            });
                          }

                          const result = await callStudentAdminApi("POST", {
                            action: "bulk-import",
                            schoolId,
                            schoolName,
                            npsn,
                            rows: payloadRows,
                          });
                          const count = Number(result?.data?.count || 0);
                          const skipped = Number(result?.data?.skipped || 0);
                          if (skipped > 0) {
                            setStatus({ type: "success", text: `Berhasil import ${count} data siswa. (${skipped} baris dilewati)` });
                          } else {
                            setStatus({ type: "success", text: `Berhasil import ${count} data siswa.` });
                          }
                        } catch (err: any) {
                          setStatus({ type: "error", text: `Gagal import: ${String(err?.message || err)}` });
                        } finally {
                          setBusy(false);
                          setTimeout(() => setStatus({ type: "", text: "" }), 2500);
                        }
                      }}
                    />
                    <FileSpreadsheet className="h-4 w-4" />
                    Import Excel
                  </label>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={downloadStudentImportTemplate}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 shadow-sm backdrop-blur hover:bg-white/10 disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" />
                    Download Template
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setCreateForm((s) => ({ ...s, class: selectedClass || s.class }));
                      setCreateOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-600/90 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 hover:bg-sky-600 disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" />
                    Tambah Siswa
                  </button>
                </>
              )}

              {activeSub === "teachers" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setTeacherCreateForm((s) => ({ ...s, class: teacherClassOptions[0] || s.class || "" }));
                    setTeacherCreateOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-600/90 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 hover:bg-sky-600 disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Guru/Wali Kelas
                </button>
              )}

              {activeSub === "staff" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStaffCreateOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-600/90 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 hover:bg-sky-600 disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Petugas OSIS
                </button>
              )}

              {activeSub === "classes" && null}

              <Link
                href="/admin"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 shadow-sm backdrop-blur hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali
              </Link>
            </div>
          </div>

          <div className="grid items-start gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[196px_minmax(0,1fr)] lg:gap-5">
            <aside className="h-fit rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-xl backdrop-blur lg:max-h-full lg:overflow-y-auto">
              <div className="text-xs font-semibold tracking-widest text-slate-400">MENU DATABASE</div>
              <div className="mt-3 space-y-2">
                <Link
                  href="/admin/students?sub=students"
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    activeSub === "students"
                      ? "border-indigo-400/30 bg-indigo-500/10 text-white"
                      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  <span>Siswa</span>
                  <span className="text-xs text-slate-400">1</span>
                </Link>
                <Link
                  href="/admin/students?sub=teachers"
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    activeSub === "teachers"
                      ? "border-indigo-400/30 bg-indigo-500/10 text-white"
                      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  <span>Guru/Wali Kelas</span>
                  <span className="text-xs text-slate-400">2</span>
                </Link>
                <Link
                  href="/admin/students?sub=staff"
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    activeSub === "staff"
                      ? "border-indigo-400/30 bg-indigo-500/10 text-white"
                      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  <span>Petugas OSIS</span>
                  <span className="text-xs text-slate-400">3</span>
                </Link>
                <Link
                  href="/admin/students?sub=classes"
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    activeSub === "classes"
                      ? "border-indigo-400/30 bg-indigo-500/10 text-white"
                      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  <span>Kelas Paralel</span>
                  <span className="text-xs text-slate-400">4</span>
                </Link>
              </div>
            </aside>

            <div className="space-y-6 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            {status.type && (
              <div
                className={`rounded-xl border p-4 text-sm backdrop-blur ${
                  status.type === "success"
                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                    : "border-red-400/20 bg-red-500/10 text-red-100"
                }`}
              >
                {status.text}
              </div>
            )}

            {activeSub === "teachers" ? (
          <>
            <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-4 text-indigo-100 backdrop-blur">
              <div className="flex items-start gap-2">
                <Lock className="mt-0.5 h-5 w-5 text-indigo-200" />
                <div>
                  <div className="font-semibold">Data Induk Login APK GAS Guru/Wali Kelas</div>
                  <div className="mt-1 text-sm">
                    Menu DATABASE admin sekolah adalah induk akun guru/wali kelas untuk operasional sekolah.
                    Data guru pada tab ini dipakai oleh <span className="font-semibold">APK GAS</span> dan tidak dipakai oleh APK EduLock.
                    Username awal memakai <span className="font-semibold">Nama Guru/Wali Kelas</span> dan password login awal memakai{" "}
                    <span className="font-semibold">NUPTK</span>.
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-12 pr-4 text-sm text-slate-100 placeholder:text-slate-400 shadow-sm backdrop-blur focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                placeholder="Cari Nama Guru..."
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-sm backdrop-blur">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-sm">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">Nama</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">NUPTK / Password Login</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">Kelas</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-300">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredTeachers.map((r) => {
                      const isActive = (r.status || "Aktif") === "Aktif";
                      const classValue = normalize(r.class);
                      const classLabel = classValue ? (classValue.toUpperCase().includes("KELAS") ? classValue : `Kelas ${classValue}`) : "-";
                      return (
                        <tr key={r.nuptk} className="hover:bg-white/5">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white">{r.name || "-"}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-200">{r.nuptk || "-"}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold text-fuchsia-200 ring-1 ring-fuchsia-400/20">
                              {classLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                                isActive
                                  ? "bg-emerald-500/10 text-emerald-200 ring-emerald-400/20"
                                  : "bg-white/5 text-slate-200 ring-white/10"
                              }`}
                            >
                              {isActive ? "Aktif" : "Nonaktif"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-3">
                              <button
                                type="button"
                                disabled={busy || !r.deviceId}
                                onClick={() => resetTeacherDeviceBinding(r.nuptk)}
                                className={`disabled:opacity-50 ${r.deviceId ? "text-amber-300 hover:text-amber-200" : "text-slate-500"}`}
                                aria-label="Reset Device Binding"
                                title={r.deviceId ? "Reset Device Binding" : "Belum ada device binding"}
                              >
                                <Smartphone className="h-5 w-5" />
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => startTeacherEdit(r)}
                                className="text-sky-300 hover:text-sky-200 disabled:opacity-50"
                                aria-label="Edit"
                              >
                                <Pencil className="h-5 w-5" />
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => deleteTeacherRow(r.nuptk)}
                                className="text-red-300 hover:text-red-200 disabled:opacity-50"
                                aria-label="Hapus"
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredTeachers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          Belum ada data guru/wali kelas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-sm text-slate-300">
              Menampilkan {filteredTeachers.length} dari{" "}
              {teacherRows.filter((r) => !schoolId || normalize(r.schoolId).toLowerCase() === schoolId.toLowerCase()).length} guru
            </div>
          </>
        ) : activeSub === "staff" ? (
          <>
            <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-4 text-indigo-100 backdrop-blur">
              <div className="flex items-start gap-2">
                <Lock className="mt-0.5 h-5 w-5 text-indigo-200" />
                <div>
                  <div className="font-semibold">Data Induk Akses Petugas OSIS</div>
                  <div className="mt-1 text-sm">
                    Petugas OSIS tetap memakai akun induk siswa. Hak akses OSIS akan aktif jika NISN terdaftar sebagai{" "}
                    <span className="font-semibold">Petugas (OSIS)</span> saat modul APK terkait nanti dibangun.
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-12 pr-4 text-sm text-slate-100 placeholder:text-slate-400 shadow-sm backdrop-blur focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                placeholder="Cari Nama, NISN, Jabatan, atau Kelas..."
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-sm backdrop-blur">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-sm">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">Nama</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">NISN</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">Kelas</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">Jabatan</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-300">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredStaff.map((r) => {
                      const isActive = (r.status || "Aktif") === "Aktif";
                      const student = studentRows.find((s) => normalize(s.nisn) === normalize(r.nisn));
                      return (
                        <tr key={r.nisn} className="hover:bg-white/5">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white">{student?.name || "-"}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-200">{r.nisn || "-"}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200 ring-1 ring-sky-400/20">
                              {student?.class || "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold text-fuchsia-200 ring-1 ring-fuchsia-400/20">
                              {normalize(r.position) || "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                                isActive
                                  ? "bg-emerald-500/10 text-emerald-200 ring-emerald-400/20"
                                  : "bg-white/5 text-slate-200 ring-white/10"
                              }`}
                            >
                              {isActive ? "Aktif" : "Nonaktif"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-3">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => startStaffEdit(r)}
                                className="text-sky-300 hover:text-sky-200 disabled:opacity-50"
                                aria-label="Edit"
                              >
                                <Pencil className="h-5 w-5" />
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => deleteStaffRow(r.nisn)}
                                className="text-red-300 hover:text-red-200 disabled:opacity-50"
                                aria-label="Hapus"
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredStaff.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          Belum ada petugas (OSIS).
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-sm text-slate-300">
              Menampilkan {filteredStaff.length} dari{" "}
              {staffRows
                .filter((r) => !schoolId || normalize(r.schoolId).toLowerCase() === schoolId.toLowerCase())
                .filter((r) => (r.role || "osis") === "osis").length}{" "}
              petugas
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur">
              <div className="flex flex-wrap gap-2">
                {gradeTabs.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGrade(g)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ring-1 ${
                      selectedGrade === g
                        ? "bg-indigo-600/90 text-white ring-white/10"
                        : "bg-white/5 text-slate-200 ring-white/10 hover:bg-white/10"
                    }`}
                  >
                    {g === 7 ? "Kelas 7" : g === 8 ? "Kelas 8" : "Kelas 9"}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-200">Kelas Paralel</div>
                  {activeSub === "classes" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setClassCreateForm({ className: "" });
                        setClassCreateOpen(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-60"
                    >
                      <Plus className="h-4 w-4" />
                      Tambah Kelas
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur">
                  <div className="divide-y divide-white/10">
                    {classOptions.map((c) => {
                      const key = normalize(c).toUpperCase();
                      const isSelected = normalize(selectedClass).toUpperCase() === key;
                      const count = studentCountByClass.get(key) || 0;
                      const suffix = normalize(c.split("-")[1] || c);
                      const avatarText = (suffix || "?").slice(0, 2).toUpperCase();
                      return (
                        <div
                          key={c}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedClass(c)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedClass(c);
                            }
                          }}
                          className={`flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition ${
                            isSelected ? "bg-white/10" : "hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sm font-extrabold text-sky-200 ring-1 ring-sky-400/20">
                              {avatarText}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-white">{c}</div>
                              <div className="mt-1 inline-flex items-center gap-2 text-sm text-slate-300">
                                <Users className="h-4 w-4 text-slate-400" />
                                {count} Siswa
                              </div>
                            </div>
                          </div>

                          {activeSub === "classes" ? (
                            <div className="flex shrink-0 items-center gap-3">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openClassEdit(c);
                                }}
                                className="text-slate-300 hover:text-white disabled:opacity-50"
                                aria-label="Edit kelas"
                              >
                                <Pencil className="h-5 w-5" />
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleClassDelete(c);
                                }}
                                className="text-slate-300 hover:text-red-200 disabled:opacity-50"
                                aria-label="Hapus kelas"
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {activeSub === "students" ? (
              <>
                <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-4 text-indigo-100 backdrop-blur">
                  Database siswa ini adalah data induk akun siswa milik sekolah.
                  <div className="mt-1 font-semibold">Username: Nama Siswa (Sesuai Data) | Password Login: NISN</div>
                  <div className="mt-1 text-xs text-indigo-200/90">
                    Data siswa pada tab ini menjadi sumber akun induk untuk <span className="font-semibold">APK GAS siswa</span> dan{" "}
                    <span className="font-semibold">APK EduLock siswa</span>. Perubahan data akan ikut terbaca realtime di dashboard admin sesuai modulnya,
                    yaitu aktivitas GAS masuk ke dashboard GAS dan aktivitas EduLock masuk ke dashboard EduLock.
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-12 pr-4 text-sm text-slate-100 placeholder:text-slate-400 shadow-sm backdrop-blur focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                    placeholder="Cari nama, NISN, atau kelas..."
                  />
                </div>

                <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-sm backdrop-blur">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-white/10 text-sm">
                      <thead className="bg-white/5">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">NISN / Password Login</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">Nama Siswa / Username Login</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">L/P</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">Kelas</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">Akun</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">Device</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-300">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {filtered.map((r) => {
                          const isActive = (r.status || "Aktif") === "Aktif";
                          const onlineMeta = getStudentOnlineMeta(r.nisn);
                          return (
                            <tr key={r.nisn} className="hover:bg-white/5">
                              <td className="px-4 py-3 font-semibold text-white">{r.nisn}</td>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-white">{r.name || "-"}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-200">{r.gender || "-"}</td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200 ring-1 ring-sky-400/20">
                                  {r.class || "-"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                                    isActive
                                      ? "bg-emerald-500/10 text-emerald-200 ring-emerald-400/20"
                                      : "bg-white/5 text-slate-200 ring-white/10"
                                  }`}
                                >
                                  {isActive ? "Aktif" : "Nonaktif"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center rounded-md bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/10">
                                  {r.device || "-"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="inline-flex flex-col items-start gap-2">
                                  <span
                                    className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${
                                      onlineMeta.isOnline
                                        ? "bg-emerald-500/10 text-emerald-200 ring-emerald-400/20"
                                        : "bg-white/5 text-slate-200 ring-white/10"
                                    }`}
                                  >
                                    {onlineMeta.isOnline ? "Online" : "Offline"}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    {onlineMeta.lastSeenAt ? `Update: ${formatDateTime(onlineMeta.lastSeenAt)}` : "Belum ada session realtime"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex items-center gap-3">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => resetStudentDeviceBinding(r.nisn)}
                                    className="text-orange-300 hover:text-orange-200 disabled:opacity-50"
                                    aria-label="Reset Device Binding"
                                    title="Reset Device Binding"
                                  >
                                    <Lock className="h-5 w-5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => startEdit(r)}
                                    className="text-sky-300 hover:text-sky-200 disabled:opacity-50"
                                    aria-label="Edit"
                                  >
                                    <Pencil className="h-5 w-5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => deleteRow(r.nisn)}
                                    className="text-red-300 hover:text-red-200 disabled:opacity-50"
                                    aria-label="Hapus"
                                  >
                                    <Trash2 className="h-5 w-5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filtered.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                              Belum ada data siswa untuk kelas ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="text-sm text-slate-300">
                  Menampilkan {filtered.length} dari{" "}
                  {studentRows.filter((r) => !schoolId || normalize(r.schoolId).toLowerCase() === schoolId.toLowerCase()).length} siswa
                </div>
              </>
            ) : null}
          </>
        )}
          </div>
        </div>
        </main>
      </div>

      {classCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl backdrop-blur">
            <div className="text-lg font-bold text-white">Tambah Kelas</div>
            <div className="mt-1 text-sm text-slate-300">Jenjang: {romanFromGrade(selectedGrade)}</div>
            <div className="mt-4 grid gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">Nama Kelas</label>
                <input
                  value={classCreateForm.className}
                  onChange={(e) => setClassCreateForm({ className: e.target.value })}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                  placeholder={`${romanFromGrade(selectedGrade)}-A`}
                />
                <div className="mt-2 text-xs text-slate-400">
                  Contoh: {romanFromGrade(selectedGrade)}-D atau cukup isi D (otomatis menjadi {romanFromGrade(selectedGrade)}-D)
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setClassCreateOpen(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleClassCreate}
                className="rounded-lg bg-indigo-600/90 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 hover:bg-indigo-600 disabled:opacity-60"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {classEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl backdrop-blur">
            <div className="text-lg font-bold text-white">Edit Kelas</div>
            <div className="mt-1 text-sm text-slate-300">Kelas saat ini: {classEditingName || "-"}</div>
            <div className="mt-4 grid gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">Nama Kelas Baru</label>
                <input
                  value={classEditForm.className}
                  onChange={(e) => setClassEditForm({ className: e.target.value })}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                  placeholder={`${romanFromGrade(selectedGrade)}-A`}
                />
                <div className="mt-2 text-xs text-slate-400">
                  Contoh: {romanFromGrade(selectedGrade)}-D atau cukup isi D (otomatis menjadi {romanFromGrade(selectedGrade)}-D)
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setClassEditOpen(false);
                  setClassEditingName("");
                }}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleClassEditSave}
                className="rounded-lg bg-indigo-600/90 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 hover:bg-indigo-600 disabled:opacity-60"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl backdrop-blur">
            <div className="text-lg font-bold text-white">Tambah Siswa</div>
            <div className="mt-1 text-sm text-slate-300">{schoolName ? `Sekolah: ${schoolName}` : ""}</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">NISN (Password Login)</label>
                <input
                  value={createForm.nisn}
                  onChange={(e) => setCreateForm((s) => ({ ...s, nisn: e.target.value }))}
                  disabled={busy}
                  inputMode="numeric"
                  placeholder="Isi NISN siswa sebagai password login awal"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                />
                <div className="mt-2 text-xs text-slate-400">NISN dipakai sebagai password login awal siswa.</div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">L/P</label>
                <select
                  value={createForm.gender}
                  onChange={(e) => setCreateForm((s) => ({ ...s, gender: e.target.value as any }))}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                >
                  <option value="L" className="bg-slate-950 text-slate-100">
                    L
                  </option>
                  <option value="P" className="bg-slate-950 text-slate-100">
                    P
                  </option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">Agama</label>
                <select
                  value={createForm.religion}
                  onChange={(e) => setCreateForm((s) => ({ ...s, religion: e.target.value as any }))}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                >
                  <option value="ISLAM" className="bg-slate-950 text-slate-100">
                    Islam
                  </option>
                  <option value="NON_ISLAM" className="bg-slate-950 text-slate-100">
                    Non Muslim
                  </option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">Nama Siswa (Username Login)</label>
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))}
                  disabled={busy}
                  placeholder="Isi nama siswa sesuai username login"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                />
                <div className="mt-2 text-xs text-slate-400">Nama siswa dipakai sebagai username login.</div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">Kelas</label>
                <select
                  value={createForm.class}
                  onChange={(e) => setCreateForm((s) => ({ ...s, class: e.target.value }))}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                >
                  <option value="" disabled className="bg-slate-950 text-slate-400">
                    Pilih kelas...
                  </option>
                  {classOptions.map((c) => (
                    <option key={c} value={c} className="bg-slate-950 text-slate-100">
                      {c}
                    </option>
                  ))}
                </select>
                <div className="mt-2 text-xs text-slate-400">Kelas hanya bisa dipilih dari daftar Kelas Paralel.</div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleCreate}
                className="rounded-lg bg-indigo-600/90 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 hover:bg-indigo-600 disabled:opacity-60"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {teacherCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl backdrop-blur">
            <div className="text-lg font-bold text-white">Tambah Guru/Wali Kelas</div>
            <div className="mt-1 text-sm text-slate-300">{schoolName ? `Sekolah: ${schoolName}` : ""}</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">NUPTK (Password Login)</label>
                <input
                  value={teacherCreateForm.nuptk}
                  onChange={(e) => setTeacherCreateForm((s) => ({ ...s, nuptk: e.target.value }))}
                  disabled={busy}
                  inputMode="numeric"
                  placeholder="Isi NUPTK guru sebagai password login awal"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                />
                <div className="mt-2 text-xs text-slate-400">NUPTK dipakai sebagai password login awal guru.</div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">Kelas</label>
                <select
                  value={teacherCreateForm.class}
                  onChange={(e) => setTeacherCreateForm((s) => ({ ...s, class: e.target.value }))}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                >
                  <option value="" disabled className="bg-slate-950 text-slate-400">
                    Pilih kelas...
                  </option>
                  {teacherCreateForm.class && !allowedTeacherClassSet.has(normalize(teacherCreateForm.class).toUpperCase()) && (
                    <option value={teacherCreateForm.class} className="bg-slate-950 text-slate-100">
                      {teacherCreateForm.class}
                    </option>
                  )}
                  {teacherClassOptions.map((c) => (
                    <option key={c} value={c} className="bg-slate-950 text-slate-100">
                      {c}
                    </option>
                  ))}
                </select>
                <div className="mt-2 text-xs text-slate-400">Kelas hanya bisa dipilih dari daftar Kelas Paralel.</div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">Nama Guru (Username Login)</label>
                <input
                  value={teacherCreateForm.name}
                  onChange={(e) => setTeacherCreateForm((s) => ({ ...s, name: e.target.value }))}
                  disabled={busy}
                  placeholder="Isi nama guru sesuai username login"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                />
                <div className="mt-2 text-xs text-slate-400">Nama guru dipakai sebagai username login.</div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setTeacherCreateOpen(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleTeacherCreate}
                className="rounded-lg bg-indigo-600/90 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 hover:bg-indigo-600 disabled:opacity-60"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {teacherEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl backdrop-blur">
            <div className="text-lg font-bold text-white">Edit Guru/Wali Kelas</div>
            <div className="mt-1 text-sm text-slate-300">{teacherEditingNuptk ? `NUPTK (Password Login): ${teacherEditingNuptk}` : ""}</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">Nama Guru (Username Login)</label>
                <input
                  value={teacherEditForm.name}
                  onChange={(e) => setTeacherEditForm((s) => ({ ...s, name: e.target.value }))}
                  disabled={busy}
                  placeholder="Perbarui nama guru sesuai username login"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                />
                <div className="mt-2 text-xs text-slate-400">Nama guru tetap dipakai sebagai username login.</div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">Kelas</label>
                <select
                  value={teacherEditForm.class}
                  onChange={(e) => setTeacherEditForm((s) => ({ ...s, class: e.target.value }))}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                >
                  <option value="" disabled className="bg-slate-950 text-slate-400">
                    Pilih kelas...
                  </option>
                  {teacherEditForm.class && !allowedTeacherClassSet.has(normalize(teacherEditForm.class).toUpperCase()) && (
                    <option value={teacherEditForm.class} className="bg-slate-950 text-slate-100">
                      {teacherEditForm.class}
                    </option>
                  )}
                  {teacherClassOptions.map((c) => (
                    <option key={c} value={c} className="bg-slate-950 text-slate-100">
                      {c}
                    </option>
                  ))}
                </select>
                <div className="mt-2 text-xs text-slate-400">Kelas hanya bisa dipilih dari daftar Kelas Paralel.</div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">Status</label>
                <select
                  value={teacherEditForm.status}
                  onChange={(e) => setTeacherEditForm((s) => ({ ...s, status: e.target.value as any }))}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                >
                  <option value="Aktif" className="bg-slate-950 text-slate-100">
                    Aktif
                  </option>
                  <option value="Nonaktif" className="bg-slate-950 text-slate-100">
                    Nonaktif
                  </option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={cancelTeacherEdit}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={saveTeacherEdit}
                className="rounded-lg bg-indigo-600/90 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 hover:bg-indigo-600 disabled:opacity-60"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {tatibCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl backdrop-blur">
            <div className="text-lg font-bold text-white">Tambah Petugas OSIS</div>
            <div className="mt-1 text-sm text-slate-300">{schoolName ? `Sekolah: ${schoolName}` : ""}</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">Nama Lengkap</label>
                <input
                  value={tatibCreateForm.name}
                  onChange={(e) => setTatibCreateForm((s) => ({ ...s, name: e.target.value }))}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">Username</label>
                <input
                  value={tatibCreateForm.username}
                  onChange={(e) => setTatibCreateForm((s) => ({ ...s, username: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">Password</label>
                <input
                  type="password"
                  value={tatibCreateForm.password}
                  onChange={(e) => setTatibCreateForm((s) => ({ ...s, password: e.target.value }))}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                />
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  id="tatibActiveCreate"
                  type="checkbox"
                  checked={tatibCreateForm.isActive}
                  onChange={(e) => setTatibCreateForm((s) => ({ ...s, isActive: e.target.checked }))}
                  disabled={busy}
                />
                <label htmlFor="tatibActiveCreate" className="text-sm text-slate-200">
                  Akun aktif
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setTatibCreateOpen(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleTatibCreate}
                className="rounded-lg bg-indigo-600/90 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 hover:bg-indigo-600 disabled:opacity-60"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {tatibEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl backdrop-blur">
            <div className="text-lg font-bold text-white">Edit Petugas OSIS</div>
            <div className="mt-1 text-sm text-slate-300">{tatibEditingUsername ? `Username: ${tatibEditingUsername}` : ""}</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">Nama Lengkap</label>
                <input
                  value={tatibEditForm.name}
                  onChange={(e) => setTatibEditForm((s) => ({ ...s, name: e.target.value }))}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">Password</label>
                <input
                  type="password"
                  value={tatibEditForm.password}
                  onChange={(e) => setTatibEditForm((s) => ({ ...s, password: e.target.value }))}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                />
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  id="tatibActiveEdit"
                  type="checkbox"
                  checked={tatibEditForm.isActive}
                  onChange={(e) => setTatibEditForm((s) => ({ ...s, isActive: e.target.checked }))}
                  disabled={busy}
                />
                <label htmlFor="tatibActiveEdit" className="text-sm text-slate-200">
                  Akun aktif
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={cancelTatibEdit}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={saveTatibEdit}
                className="rounded-lg bg-indigo-600/90 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 hover:bg-indigo-600 disabled:opacity-60"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {staffCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl backdrop-blur">
            <div className="text-lg font-bold text-white">Tambah Petugas (OSIS)</div>
            <div className="mt-1 text-sm text-slate-300">{schoolName ? `Sekolah: ${schoolName}` : ""}</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">NISN</label>
                <input
                  value={staffCreateForm.nisn}
                  onChange={(e) => setStaffCreateForm((s) => ({ ...s, nisn: e.target.value }))}
                  disabled={busy}
                  inputMode="numeric"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                />
              </div>
              <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200 backdrop-blur">
                <div className="font-semibold text-white">Data Siswa</div>
                <div className="mt-1">
                  Nama: <span className="font-semibold text-slate-100">{staffCandidateStudent?.name || "-"}</span>
                </div>
                <div className="mt-1">
                  Kelas: <span className="font-semibold text-slate-100">{staffCandidateStudent?.class || "-"}</span>
                </div>
                {!normalize(staffCreateForm.nisn) ? null : staffCandidateStudent ? null : (
                  <div className="mt-2 text-red-200">NISN tidak ditemukan di Database Siswa sekolah ini.</div>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">Jabatan (Opsional)</label>
                <input
                  value={staffCreateForm.position}
                  onChange={(e) => setStaffCreateForm((s) => ({ ...s, position: e.target.value }))}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                  placeholder="Ketua OSIS / Sekretaris / Bendahara / dll"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setStaffCreateOpen(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleStaffCreate}
                className="rounded-lg bg-indigo-600/90 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 hover:bg-indigo-600 disabled:opacity-60"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {staffEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl backdrop-blur">
            <div className="text-lg font-bold text-white">Edit Petugas (OSIS)</div>
            <div className="mt-1 text-sm text-slate-300">{staffEditingNisn ? `NISN: ${staffEditingNisn}` : ""}</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200 backdrop-blur">
                <div className="font-semibold text-white">Data Siswa</div>
                <div className="mt-1">
                  Nama:{" "}
                  <span className="font-semibold text-slate-100">
                    {studentRows.find((s) => normalize(s.nisn) === normalize(staffEditingNisn))?.name || "-"}
                  </span>
                </div>
                <div className="mt-1">
                  Kelas:{" "}
                  <span className="font-semibold text-slate-100">
                    {studentRows.find((s) => normalize(s.nisn) === normalize(staffEditingNisn))?.class || "-"}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">Status</label>
                <select
                  value={staffEditForm.status}
                  onChange={(e) => setStaffEditForm((s) => ({ ...s, status: e.target.value as any }))}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                >
                  <option value="Aktif" className="bg-slate-950 text-slate-100">
                    Aktif
                  </option>
                  <option value="Nonaktif" className="bg-slate-950 text-slate-100">
                    Nonaktif
                  </option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">Jabatan</label>
                <input
                  value={staffEditForm.position}
                  onChange={(e) => setStaffEditForm((s) => ({ ...s, position: e.target.value }))}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={cancelStaffEdit}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={saveStaffEdit}
                className="rounded-lg bg-indigo-600/90 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 hover:bg-indigo-600 disabled:opacity-60"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
