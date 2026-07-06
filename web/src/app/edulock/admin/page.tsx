"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { equalTo, onValue, orderByChild, query, ref, remove, set, update } from "firebase/database";
import { signOut, updatePassword } from "firebase/auth";
import * as XLSX from "xlsx";
import { database } from "@/lib/firebase";
import { edulockAuth, edulockDb } from "@/lib/edulockFirebase";
import { useEduLockAuth } from "@/lib/useEduLockAuth";
import { useAuthStore } from "@/store/useAuthStore";
import {
  Activity,
  ArrowLeft,
  Clock,
  Download,
  Key,
  LayoutDashboard,
  Lock,
  LogOut,
  Map as MapIcon,
  MapPin,
  Menu,
  Plus,
  RefreshCw,
  Save,
  Settings,
  ShieldAlert,
  Trash2,
  Unlock,
  UserCog,
  Users,
  Wifi,
  X,
} from "lucide-react";
import QRCode from "react-qr-code";

type Tab = "dashboard" | "monitoring" | "codes" | "classes" | "geofencing" | "students" | "violations" | "settings";

function isAdminTab(value: string): value is Tab {
  return ["dashboard", "monitoring", "codes", "classes", "geofencing", "students", "violations", "settings"].includes(value);
}

interface StudentRow {
  nisn: string;
  name?: string;
  class?: string;
  schoolId?: string;
  schoolName?: string;
  npsn?: string;
  device_uuid?: string | null;
  deviceStatus?: string;
  lastUpdated?: number;
  statusMessage?: string;
  trustScore?: number;
  isInsideZone?: boolean;
  isInternetActive?: boolean;
  uninstall_authorized?: boolean;
  [key: string]: any;
}

interface ActiveSessionRow {
  nisn: string;
  name?: string;
  schoolId?: string;
  schoolName?: string;
  isInsideZone?: boolean;
  isInternetActive?: boolean;
  isOnline?: boolean;
  endTime?: number;
  lastUpdated?: number;
  updatedAt?: number;
  lastSeen?: number;
  [key: string]: any;
}

interface ViolationRow {
  id: string;
  nisn?: string;
  schoolId?: string;
  type?: string;
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
  timestamp?: number | null;
  date?: string;
  [key: string]: any;
}

const WEEKDAY_ROWS = [
  { key: "mon", label: "Senin" },
  { key: "tue", label: "Selasa" },
  { key: "wed", label: "Rabu" },
  { key: "thu", label: "Kamis" },
  { key: "fri", label: "Jumat" },
  { key: "sat", label: "Sabtu" },
  { key: "sun", label: "Minggu" },
] as const;

export default function EduLockSchoolAdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useEduLockAuth();
  const portalUser = useAuthStore((state) => state.user);

  const portalSchoolId = String(portalUser?.role === "admin" ? portalUser?.schoolId || "" : "").trim().toLowerCase();
  const portalSchoolName = String(portalUser?.role === "admin" ? portalUser?.schoolName || "" : "").trim();
  const portalNpsn = String(portalUser?.role === "admin" ? portalUser?.npsn || "" : "").trim();

  const schoolId = (portalSchoolId || String(profile?.schoolId || "").trim()).toLowerCase();
  const schoolName = portalSchoolName || String(profile?.schoolName || "").trim();
  const npsn = portalNpsn || String(profile?.npsn || "").trim();

  const callEduLockSecurityApi = async (
    method: "POST" | "PUT" | "DELETE",
    payload: Record<string, any>
  ) => {
    const currentUser = edulockAuth.currentUser;
    if (!currentUser) {
      throw new Error("Sesi EduLock tidak aktif. Silakan login ulang.");
    }

    const idToken = await currentUser.getIdToken();
    const response = await fetch("/api/admin/edulock/security", {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success === false) {
      throw new Error(String(result?.message || "Permintaan keamanan EduLock gagal diproses."));
    }

    return result;
  };

  const callAdminStudentApi = async (
    method: "POST" | "PUT" | "DELETE",
    payload: Record<string, any>
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
      throw new Error(String(result?.message || "Permintaan data siswa gagal diproses."));
    }

    return result;
  };

  const fetchAdminStudentSnapshot = async (currentSchoolId: string) => {
    const currentUser = edulockAuth.currentUser;
    if (!currentUser) {
      throw new Error("Sesi EduLock tidak aktif. Silakan login ulang.");
    }

    const idToken = await currentUser.getIdToken();
    const search = new URLSearchParams();
    if (currentSchoolId) search.set("schoolId", currentSchoolId);
    const response = await fetch(`/api/admin/students?${search.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      cache: "no-store",
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success === false) {
      throw new Error(String(result?.message || "Gagal memuat data induk siswa dari backend."));
    }

    return result?.data || {};
  };

  const pad2 = (value: number) => String(value).padStart(2, "0");
  const now = new Date();
  const defaultStart = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const defaultEnd = `${pad2((now.getHours() + 1) % 24)}:${pad2(now.getMinutes())}`;

  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeCodes, setActiveCodes] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionRow[]>([]);
  const [masterStudents, setMasterStudents] = useState<StudentRow[]>([]);
  const [edulockStudents, setEdulockStudents] = useState<StudentRow[]>([]);
  const [violations, setViolations] = useState<ViolationRow[]>([]);
  const [classCatalog, setClassCatalog] = useState<Array<{ key: string; name: string; createdAt?: number; updatedAt?: number }>>([]);
  const [disabledClassKeys, setDisabledClassKeys] = useState<string[]>([]);

  const [startTimeInput, setStartTimeInput] = useState(defaultStart);
  const [endTimeInput, setEndTimeInput] = useState(defaultEnd);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "" | "success" | "error"; text: string }>({ type: "", text: "" });

  const [mustChangeGate, setMustChangeGate] = useState(Boolean(profile?.mustChangePassword));
  const [forcedPassword, setForcedPassword] = useState("");
  const [schoolConfig, setSchoolConfig] = useState<Record<string, any>>({
    latitude: "",
    longitude: "",
    radius: 100,
    startTime: "07:00",
    endTime: "14:00",
    is_holiday_mode: false,
    is_active_protection: true,
  });
  const [uninstallAccess, setUninstallAccess] = useState<any>(null);

  const [bulkRevokeClassesText, setBulkRevokeClassesText] = useState("");
  const [studentClassFilterKey, setStudentClassFilterKey] = useState<string>("all");
  const [monitoringClassFilterKey, setMonitoringClassFilterKey] = useState<string>("all");

  type WeekdayKey = (typeof WEEKDAY_ROWS)[number]["key"];
  type WeekdaySchedule = { enabled: boolean; start: string; end: string };

  const [weekdaySchedule, setWeekdaySchedule] = useState<Record<WeekdayKey, WeekdaySchedule>>({
    mon: { enabled: true, start: "07:00", end: "14:00" },
    tue: { enabled: true, start: "07:00", end: "14:00" },
    wed: { enabled: true, start: "07:00", end: "14:00" },
    thu: { enabled: true, start: "07:00", end: "14:00" },
    fri: { enabled: true, start: "07:00", end: "14:00" },
    sat: { enabled: true, start: "07:00", end: "12:00" },
    sun: { enabled: false, start: "07:00", end: "12:00" },
  });

  const [holidayDateInput, setHolidayDateInput] = useState("");
  const [holidayNoteInput, setHolidayNoteInput] = useState("");
  const [holidayList, setHolidayList] = useState<Array<{ date: string; note: string; createdAt?: number }>>([]);
  const [gpsWarnMinutes, setGpsWarnMinutes] = useState<number>(3);
  const [gpsLockMinutes, setGpsLockMinutes] = useState<number>(5);

  useEffect(() => {
    setMustChangeGate(Boolean(profile?.mustChangePassword));
  }, [profile?.mustChangePassword]);

  useEffect(() => {
    if (!schoolId) return;
    const configRef = ref(edulockDb, `schools/${schoolId}/config`);
    const unsub = onValue(configRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        setSchoolConfig((prev) => ({ ...prev, ...data }));
      }
    });
    return () => unsub();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) {
      setUninstallAccess(null);
      return;
    }
    const uninstallRef = ref(edulockDb, `schools/${schoolId}/uninstallAccess`);
    const unsub = onValue(uninstallRef, (snapshot) => {
      const v = snapshot.exists() ? (snapshot.val() || {}) : null;
      if (!v || typeof v !== "object") {
        setUninstallAccess(null);
        return;
      }
      setUninstallAccess({
        code: v?.code ? String(v.code) : "",
        expiresAt: typeof v?.expiresAt === "number" ? v.expiresAt : null,
        createdAt: typeof v?.createdAt === "number" ? v.createdAt : null,
        createdBy: v?.createdBy ? String(v.createdBy) : "",
      });
    });
    return () => unsub();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    const policyRef = ref(edulockDb, `schools/${schoolId}/policy`);
    const unsub = onValue(policyRef, (snapshot) => {
      const v = snapshot.exists() ? (snapshot.val() || {}) : null;
      if (!v || typeof v !== "object") return;

      const warnMsRaw = (v as any)?.gps_off_warn_ms;
      const lockMsRaw = (v as any)?.gps_off_lock_ms;
      const warnMs = typeof warnMsRaw === "number" ? warnMsRaw : Number(warnMsRaw || 0);
      const lockMs = typeof lockMsRaw === "number" ? lockMsRaw : Number(lockMsRaw || 0);

      if (Number.isFinite(warnMs) && warnMs >= 0) setGpsWarnMinutes(Math.floor(warnMs / 60000));
      if (Number.isFinite(lockMs) && lockMs >= 0) setGpsLockMinutes(Math.floor(lockMs / 60000));
    });
    return () => unsub();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    const scheduleRef = ref(edulockDb, `schools/${schoolId}/schedule/weekdays`);
    const unsub = onValue(scheduleRef, (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data !== "object") return;
      setWeekdaySchedule((prev) => {
        const next = { ...prev } as Record<WeekdayKey, WeekdaySchedule>;
        WEEKDAY_ROWS.forEach((d) => {
          const row = (data as any)?.[d.key];
          if (!row || typeof row !== "object") return;
          next[d.key] = {
            enabled: Boolean((row as any).enabled),
            start: String((row as any).start || prev[d.key].start),
            end: String((row as any).end || prev[d.key].end),
          };
        });
        return next;
      });
    });
    return () => unsub();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    const holidaysRef = ref(edulockDb, `schools/${schoolId}/holidays`);
    const unsub = onValue(holidaysRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        const list = Object.entries(data).map(([key, value]) => ({
          date: String((value as any)?.date || key),
          note: String((value as any)?.note || ""),
          createdAt: typeof (value as any)?.createdAt === "number" ? (value as any).createdAt : undefined,
        }));
        list.sort((a, b) => a.date.localeCompare(b.date));
        setHolidayList(list);
      } else {
        setHolidayList([]);
      }
    });
    return () => unsub();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) {
      setActiveCodes([]);
      return;
    }
    const codesRef = query(ref(edulockDb, "active_codes"), orderByChild("schoolId"), equalTo(schoolId));
    const unsub = onValue(codesRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        const codesList = Object.entries(data).map(([key, value]) => ({
          code: String(key),
          ...(value as any),
        }));
        setActiveCodes(codesList);
      } else {
        setActiveCodes([]);
      }
    });
    return () => unsub();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) {
      setActiveSessions([]);
      return;
    }
    const sessionsRef = ref(edulockDb, `active_sessions_by_school/${schoolId}`);
    const unsub = onValue(sessionsRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        const sessionsList: ActiveSessionRow[] = Object.entries(data).map(([key, value]) => ({
          nisn: String(key),
          ...(value as any),
        }));
        setActiveSessions(sessionsList);
      } else {
        setActiveSessions([]);
      }
    });
    return () => unsub();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) {
      setEdulockStudents([]);
      return;
    }

    let disposed = false;
    const studentUnsubs = new Map<string, () => void>();
    const studentMap = new Map<string, StudentRow>();

    const syncStudents = () => {
      if (disposed) return;
      const list = Array.from(studentMap.values());
      list.sort((a, b) => (Number(b.lastUpdated || 0) || 0) - (Number(a.lastUpdated || 0) || 0));
      setEdulockStudents(list);
    };

    const detachStudent = (nisnValue: string) => {
      const unsub = studentUnsubs.get(nisnValue);
      if (!unsub) return;
      unsub();
      studentUnsubs.delete(nisnValue);
      studentMap.delete(nisnValue);
    };

    const attachStudent = (nisnValue: string) => {
      if (!nisnValue || studentUnsubs.has(nisnValue)) return;
      const unsub = onValue(ref(edulockDb, `students/${nisnValue}`), (snapshot) => {
        if (!snapshot.exists()) {
          studentMap.delete(nisnValue);
          syncStudents();
          return;
        }
        studentMap.set(nisnValue, {
          nisn: nisnValue,
          ...(snapshot.val() as any),
        });
        syncStudents();
      });
      studentUnsubs.set(nisnValue, unsub);
    };

    const unsubIndex = onValue(ref(edulockDb, `students_by_school/${schoolId}`), (snapshot) => {
      const data = snapshot.val();
      const nextNisnSet = new Set<string>(
        data && typeof data === "object"
          ? Object.keys(data)
              .map((key) => String(key || "").trim())
              .filter(Boolean)
          : []
      );

      for (const nisnValue of Array.from(studentUnsubs.keys())) {
        if (!nextNisnSet.has(nisnValue)) detachStudent(nisnValue);
      }

      for (const nisnValue of nextNisnSet) {
        attachStudent(nisnValue);
      }

      if (nextNisnSet.size === 0) {
        studentMap.clear();
        syncStudents();
      }
    });

    return () => {
      disposed = true;
      unsubIndex();
      for (const unsub of studentUnsubs.values()) unsub();
      studentUnsubs.clear();
      studentMap.clear();
    };
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) {
      setMasterStudents([]);
      setStatusMessage((prev) => (prev.type === "error" && prev.text.includes("DATABASE GAS") ? { type: "", text: "" } : prev));
      return;
    }
    let disposed = false;

    void fetchAdminStudentSnapshot(schoolId)
      .then((data) => {
        if (disposed) return;
        const list: StudentRow[] = Array.isArray(data?.students)
          ? data.students
              .map((row: any) => {
                const nisnValue = String(row?.nisn || "").trim();
                const nameValue = String(row?.name || "").trim();
                const rowSchoolId = String(row?.schoolId || "").trim().toLowerCase();
                if (!nisnValue || !nameValue) return null;
                return {
                  nisn: nisnValue,
                  name: nameValue,
                  class: String(row?.className || row?.class || "").trim(),
                  schoolId: rowSchoolId,
                  schoolName: String(row?.schoolName || "").trim(),
                  npsn: String(row?.npsn || "").trim(),
                } as StudentRow;
              })
              .filter(Boolean) as StudentRow[]
          : [];
        list.sort((a, b) => String(a.class || "").localeCompare(String(b.class || ""), "id-ID") || String(a.name || "").localeCompare(String(b.name || ""), "id-ID"));
        setMasterStudents(list);
        setStatusMessage((prev) => (prev.type === "error" && prev.text.includes("DATABASE GAS") ? { type: "", text: "" } : prev));
      })
      .catch((error: any) => {
        if (disposed) return;
        console.error("EduLock backend student snapshot failed:", error);
        setMasterStudents([]);
        setStatusMessage({ type: "error", text: String(error?.message || "Gagal membaca data induk siswa dari backend DATABASE.") });
      });

    return () => {
      disposed = true;
    };
  }, [schoolId]);

  const students = useMemo(() => {
    const extraByNisn = new Map<string, StudentRow>();
    edulockStudents.forEach((s) => {
      const k = String(s.nisn || "").trim();
      if (!k) return;
      extraByNisn.set(k, s);
    });
    return masterStudents.map((base) => {
      const extra = extraByNisn.get(String(base.nisn || "").trim());
      if (!extra) return base;
      return {
        ...extra,
        nisn: base.nisn,
        name: base.name,
        class: base.class,
        schoolId: base.schoolId,
        schoolName: base.schoolName,
        npsn: base.npsn,
      } as StudentRow;
    });
  }, [edulockStudents, masterStudents]);

  const schoolStudentNisnsForViolations = useMemo(() => {
    if (!schoolId) return [] as string[];
    return Array.from(
      new Set(
        students
          .filter((student) => String(student.schoolId || "").trim().toLowerCase() === schoolId)
          .map((student) => String(student.nisn || "").trim())
          .filter(Boolean)
      )
    );
  }, [schoolId, students]);

  useEffect(() => {
    if (!schoolId) {
      setViolations([]);
      return;
    }

    let disposed = false;
    const bySchoolRef = ref(edulockDb, `violations_by_school/${schoolId}`);
    const fallbackUnsubs = new Map<string, () => void>();
    const fallbackMap = new Map<string, ViolationRow>();
    const fallbackIdsByNisn = new Map<string, Set<string>>();

    const syncFallback = () => {
      if (disposed) return;
      const list = Array.from(fallbackMap.values());
      list.sort((a, b) => (Number(b.timestamp || 0) || 0) - (Number(a.timestamp || 0) || 0));
      setViolations(list);
    };

    const clearFallback = () => {
      for (const unsub of fallbackUnsubs.values()) unsub();
      fallbackUnsubs.clear();
      fallbackMap.clear();
      fallbackIdsByNisn.clear();
    };

    const startFallbackLegacyReads = () => {
      clearFallback();
      if (schoolStudentNisnsForViolations.length === 0) {
        setViolations([]);
        return;
      }

      schoolStudentNisnsForViolations.forEach((nisnValue) => {
        const legacyQuery = query(ref(edulockDb, "violations"), orderByChild("nisn"), equalTo(nisnValue));
        const unsub = onValue(legacyQuery, (snapshot) => {
          const previousIds = fallbackIdsByNisn.get(nisnValue);
          if (previousIds) {
            for (const violationId of previousIds) fallbackMap.delete(violationId);
          }

          const nextIds = new Set<string>();
          const data = snapshot.val();
          if (data && typeof data === "object") {
            Object.entries(data).forEach(([key, value]) => {
              const violationId = String(key || "").trim();
              if (!violationId) return;
              nextIds.add(violationId);
              fallbackMap.set(violationId, {
                id: violationId,
                ...(value as any),
              });
            });
          }

          fallbackIdsByNisn.set(nisnValue, nextIds);
          syncFallback();
        });

        fallbackUnsubs.set(nisnValue, unsub);
      });
    };

    const unsubBySchool = onValue(bySchoolRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object" && Object.keys(data).length > 0) {
        clearFallback();
        const list: ViolationRow[] = Object.entries(data).map(([key, value]) => ({
          id: String(key),
          ...(value as any),
        }));
        list.sort((a, b) => (Number(b.timestamp || 0) || 0) - (Number(a.timestamp || 0) || 0));
        setViolations(list);
        return;
      }

      startFallbackLegacyReads();
    });

    return () => {
      disposed = true;
      unsubBySchool();
      clearFallback();
    };
  }, [schoolId, schoolStudentNisnsForViolations]);

  useEffect(() => {
    if (!schoolId) {
      setClassCatalog([]);
      setDisabledClassKeys([]);
      return;
    }
    let disposed = false;

    void fetchAdminStudentSnapshot(schoolId)
      .then((data) => {
        if (disposed) return;
        const rawClasses = Array.isArray(data?.classes) ? data.classes : [];
        const disabledKeys = rawClasses
          .filter((row: any) => Boolean(row?.disabled))
          .map((row: any) => normalizeClassKey(String(row?.name || row?.key || "")))
          .filter(Boolean);
        const list = rawClasses
          .map((row: any) => {
            const name = String(row?.name || "").trim();
            const key = normalizeClassKey(name || String(row?.key || ""));
            if (!name || !key || Boolean(row?.disabled)) return null;
            return {
              key,
              name,
              createdAt: typeof row?.createdAt === "number" ? row.createdAt : undefined,
              updatedAt: typeof row?.updatedAt === "number" ? row.updatedAt : undefined,
            };
          })
          .filter(Boolean) as Array<{ key: string; name: string; createdAt?: number; updatedAt?: number }>;
        setClassCatalog(list);
        setDisabledClassKeys(disabledKeys);
      })
      .catch((error) => {
        if (disposed) return;
        console.error("EduLock backend class snapshot failed:", error);
        setClassCatalog([]);
        setDisabledClassKeys([]);
      });

    return () => {
      disposed = true;
    };
  }, [schoolId]);

  const filteredStudents = useMemo(() => {
    if (!schoolId) return [];
    return students.filter((s) => String(s.schoolId || "").trim().toLowerCase() === schoolId);
  }, [schoolId, students]);

  const filteredSessions = useMemo(() => {
    if (!schoolId) return [];
    return activeSessions.filter((s) => String(s.schoolId || "").trim().toLowerCase() === schoolId);
  }, [schoolId, activeSessions]);

  const adminDisplayName = useMemo(() => {
    const raw = String(schoolName || "").trim();
    return raw ? `Admin ${raw}` : "Admin Sekolah";
  }, [schoolName]);

  const formatTime = (timestamp: number | null | undefined) => {
    if (!timestamp) return "-";
    try {
      return new Date(timestamp).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
    } catch {
      return "-";
    }
  };

  const isExpired = (timestamp: number | null | undefined) => {
    if (!timestamp) return false;
    return Date.now() > timestamp;
  };

  const stats = useMemo(() => {
    const online = filteredStudents.filter((s) => s.deviceStatus === "Online" || (Date.now() - Number(s.lastUpdated || 0) < 5 * 60 * 1000)).length;
    const outside = filteredStudents.filter((s) => {
      const lastSeenDiff = Date.now() - Number(s.lastUpdated || 0);
      const isOnline = s.deviceStatus === "Online" || lastSeenDiff < 5 * 60 * 1000;
      return isOnline && s.isInsideZone === false;
    }).length;
    const active = filteredSessions.length;
    return { online, outside, active };
  }, [filteredSessions.length, filteredStudents]);

  const classCatalogComputed = useMemo(() => {
    const gradeFromName = (name: string) => {
      const raw = String(name || "").trim().toUpperCase();
      if (raw.startsWith("VIII")) return 8;
      if (raw.startsWith("VII")) return 7;
      if (raw.startsWith("IX")) return 9;
      const compact = raw.replace(/\s+/g, "").replace(/-/g, "");
      if (compact.startsWith("7")) return 7;
      if (compact.startsWith("8")) return 8;
      if (compact.startsWith("9")) return 9;
      return 999;
    };

    const suffixFromName = (name: string) => {
      const raw = String(name || "").trim().toUpperCase();
      const m = raw.match(/^(VIII|VII|IX)\s*[- ]?\s*(.*)$/);
      if (m) return String(m[2] || "").trim();
      const compact = raw.replace(/\s+/g, "").replace(/-/g, "");
      const m2 = compact.match(/^(7|8|9)(.*)$/);
      if (m2) return String(m2[2] || "").trim();
      return raw;
    };

    const compareClassNames = (a: string, b: string) => {
      const ga = gradeFromName(a);
      const gb = gradeFromName(b);
      if (ga !== gb) return ga - gb;
      const sa = suffixFromName(a);
      const sb = suffixFromName(b);
      if (!sa && sb) return -1;
      if (sa && !sb) return 1;
      return sa.localeCompare(sb, "id-ID", { numeric: true, sensitivity: "base" });
    };

    const map = new Map<string, { key: string; name: string }>();
    classCatalog.forEach((item) => {
      const name = String(item?.name || item?.key || "").trim();
      const key = normalizeClassKey(name || item?.key);
      if (!name || !key) return;
      if (disabledClassKeys.includes(key)) return;
      if (!map.has(key)) map.set(key, { key, name });
    });

    const list = Array.from(map.values());
    list.sort((a, b) => compareClassNames(a.name, b.name));
    return list;
  }, [classCatalog, disabledClassKeys]);

  const classByKey = useMemo(() => {
    const map = new Map<string, { key: string; name: string }>();
    classCatalogComputed.forEach((c) => {
      const key = String(c.key || "").trim();
      if (!key) return;
      map.set(key, { key, name: String(c.name || key) });
    });
    return map;
  }, [classCatalogComputed]);

  const filteredCodes = useMemo(() => {
    if (!schoolId) return [];
    return activeCodes.filter((c) => String((c as any).schoolId || "").trim().toLowerCase() === schoolId);
  }, [activeCodes, schoolId]);

  const schoolStudentNisns = useMemo(() => {
    if (!schoolId) return [] as string[];
    return Array.from(
      new Set(
        filteredStudents
          .map((student) => String(student.nisn || "").trim())
          .filter(Boolean)
      )
    );
  }, [filteredStudents, schoolId]);

  const monitoringStudents = useMemo(() => {
    if (monitoringClassFilterKey === "all") return filteredStudents;
    return filteredStudents.filter((student) => {
      const key = String((student as any)?.classKey || normalizeClassKey(student.class)).trim();
      return key === monitoringClassFilterKey;
    });
  }, [filteredStudents, monitoringClassFilterKey]);

  const filteredViolations = useMemo(() => {
    if (!schoolId) return [] as ViolationRow[];
    const schoolStudentNisnSet = new Set(schoolStudentNisns);
    return violations
      .filter((log) => {
        const logSchoolId = String(log.schoolId || "").trim().toLowerCase();
        const logNisn = String(log.nisn || "").trim();
        if (logSchoolId) return logSchoolId === schoolId;
        return logNisn ? schoolStudentNisnSet.has(logNisn) : false;
      })
      .sort((a, b) => (Number(b.timestamp || 0) || 0) - (Number(a.timestamp || 0) || 0));
  }, [schoolId, schoolStudentNisns, violations]);

  const handleForceChangePassword = async () => {
    if (!forcedPassword || forcedPassword.length < 6) {
      setStatusMessage({ type: "error", text: "Password minimal 6 karakter." });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3000);
      return;
    }
    if (forcedPassword === "admin123") {
      setStatusMessage({ type: "error", text: "Password baru tidak boleh sama dengan admin123." });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3000);
      return;
    }

    setLoading(true);
    try {
      if (!edulockAuth.currentUser) throw new Error("User tidak terautentikasi.");
      await updatePassword(edulockAuth.currentUser, forcedPassword);
      await callEduLockSecurityApi("POST", {
        action: "password-changed",
        schoolId,
      });
      setForcedPassword("");
      setMustChangeGate(false);
      setStatusMessage({ type: "success", text: "Password berhasil diubah. Silakan lanjutkan penggunaan dashboard." });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3000);
    } catch (e: any) {
      setStatusMessage({ type: "error", text: `Gagal ubah password: ${String(e?.message || e)}` });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCode = async () => {
    setLoading(true);
    setStatusMessage({ type: "", text: "" });
    try {
      const result = await callEduLockSecurityApi("POST", {
        action: "create-code",
        schoolId,
        startTime: startTimeInput,
        endTime: endTimeInput,
      });
      const newCode = String(result?.data?.code || "");
      setStatusMessage({ type: "success", text: `Kode ${newCode} berhasil dibuat!` });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 5000);
    } catch (error: any) {
      setStatusMessage({ type: "error", text: `Gagal membuat kode: ${String(error?.message || error)}` });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCode = async (code: string) => {
    if (!window.confirm(`Hapus kode ${code}?`)) return;
    try {
      await callEduLockSecurityApi("DELETE", {
        action: "delete-code",
        schoolId,
        code,
      });
    } catch (error: any) {
      setStatusMessage({ type: "error", text: `Gagal menghapus kode: ${String(error?.message || error)}` });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3000);
    }
  };

  const handleDeleteExpiredCodes = async () => {
    const expiredCodes = filteredCodes.filter((item: any) => isExpired(item.expiresAt));
    if (expiredCodes.length === 0) {
      setStatusMessage({ type: "error", text: "Tidak ada kode yang expired untuk dihapus." });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3000);
      return;
    }
    if (!window.confirm(`Hapus ${expiredCodes.length} kode yang sudah expired?`)) return;

    setLoading(true);
    try {
      const result = await callEduLockSecurityApi("POST", {
        action: "delete-expired-codes",
        schoolId,
      });
      const count = Number(result?.data?.count || 0);
      setStatusMessage({ type: "success", text: `Berhasil menghapus ${count} kode expired.` });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3000);
    } catch (error: any) {
      setStatusMessage({ type: "error", text: `Gagal menghapus expired: ${String(error?.message || error)}` });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (nisnValue: string, name: string) => {
    if (!nisnValue) return;
    if (!window.confirm(`Batalkan izin siswa ${name}? HP akan terkunci kembali.`)) return;
    setLoading(true);
    try {
      await callEduLockSecurityApi("DELETE", {
        action: "revoke-session",
        schoolId,
        nisn: nisnValue,
      });
      setStatusMessage({ type: "success", text: `Izin untuk ${name} dibatalkan.` });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3000);
    } catch (error: any) {
      setStatusMessage({ type: "error", text: `Gagal membatalkan: ${String(error?.message || error)}` });
    } finally {
      setLoading(false);
    }
  };

  function normalizeClassKey(value: any) {
    const raw = String(value || "").trim().toUpperCase();
    if (!raw) return "";

    const compact = raw.replace(/\s+/g, "").replace(/-/g, "");
    const compactMatch = compact.match(/(VIII|VII|IX|7|8|9)([A-Z])/);
    if (compactMatch) {
      const gradePart = compactMatch[1];
      const letter = compactMatch[2];
      const grade = gradePart === "VII" ? "7" : gradePart === "VIII" ? "8" : gradePart === "IX" ? "9" : gradePart;
      return `${grade}${letter}`;
    }

    const looseMatch = raw.match(/(VIII|VII|IX|7|8|9)\s*[- ]?\s*([A-Z])\b/);
    if (looseMatch) {
      const gradePart = looseMatch[1];
      const letter = looseMatch[2];
      const grade = gradePart === "VII" ? "7" : gradePart === "VIII" ? "8" : gradePart === "IX" ? "9" : gradePart;
      return `${grade}${letter}`;
    }

    return raw.replace(/[^A-Z0-9]/g, "");
  }

  const parseClassKeysInput = (text: string) => {
    const input = String(text || "");
    const parts = input
      .split(/[\n,;]+/g)
      .map((v) => v.trim())
      .filter(Boolean);

    const keys = new Set<string>();
    parts.forEach((p) => {
      const key = normalizeClassKey(p);
      if (key) keys.add(key);
    });
    return keys;
  };

  const handleBulkRevokeByClasses = async () => {
    if (!schoolId) {
      setStatusMessage({ type: "error", text: "Sekolah admin belum ter-assign. Hubungi super admin." });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3500);
      return;
    }

    const classKeys = parseClassKeysInput(bulkRevokeClassesText);
    if (classKeys.size === 0) {
      setStatusMessage({ type: "error", text: "Masukkan daftar kelas dulu. Contoh: 7A,7B,8A,8D,9C,9F,9G" });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3500);
      return;
    }

    const targets = filteredSessions.filter((session) => {
      const directClass = normalizeClassKey((session as any)?.class);
      if (directClass && classKeys.has(directClass)) return true;
      const fallback = filteredStudents.find((s) => s.nisn === session.nisn);
      const fallbackClass = normalizeClassKey(fallback?.class);
      return Boolean(fallbackClass) && classKeys.has(fallbackClass);
    });

    if (targets.length === 0) {
      setStatusMessage({ type: "error", text: "Tidak ada sesi aktif yang cocok dengan kelas yang dipilih." });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3500);
      return;
    }

    const confirmText = `Cabut izin untuk ${targets.length} siswa (kelas: ${Array.from(classKeys).join(", ")})? HP mereka akan terkunci kembali.`;
    if (!window.confirm(confirmText)) return;

    setLoading(true);
    setStatusMessage({ type: "", text: "" });
    try {
      const result = await callEduLockSecurityApi("POST", {
        action: "revoke-sessions-by-classes",
        schoolId,
        classKeys: Array.from(classKeys),
      });
      const count = Number(result?.data?.count || 0);
      setStatusMessage({ type: "success", text: `Berhasil mencabut izin untuk ${count} siswa.` });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 4000);
    } catch (error: any) {
      setStatusMessage({ type: "error", text: `Gagal cabut izin massal: ${String(error?.message || error)}` });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWeekdaySchedule = async () => {
    if (!schoolId) return;
    setLoading(true);
    setStatusMessage({ type: "", text: "" });
    try {
      const parseMinutes = (hhmm: string) => {
        const [h, m] = String(hhmm || "").split(":").map((v) => Number(v));
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        if (h < 0 || h > 23 || m < 0 || m > 59) return null;
        return h * 60 + m;
      };

      const updates: Record<string, any> = {};
      WEEKDAY_ROWS.forEach((d) => {
        const row = weekdaySchedule[d.key];
        const startMin = parseMinutes(row.start);
        const endMin = parseMinutes(row.end);
        if (row.enabled && (startMin === null || endMin === null || endMin <= startMin)) {
          throw new Error(`Jam tidak valid untuk ${d.label}. Pastikan Jam Pulang > Jam Masuk.`);
        }
        updates[`schools/${schoolId}/schedule/weekdays/${d.key}`] = {
          enabled: Boolean(row.enabled),
          start: String(row.start || "07:00"),
          end: String(row.end || "14:00"),
        };
      });
      updates[`schools/${schoolId}/schedule/updatedAt`] = Date.now();

      await callEduLockSecurityApi("POST", {
        action: "save-weekday-schedule",
        schoolId,
        weekdaySchedule,
      });
      setStatusMessage({ type: "success", text: "Jadwal sekolah berhasil disimpan." });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3000);
    } catch (e: any) {
      setStatusMessage({ type: "error", text: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!schoolId) return;
    const date = String(holidayDateInput || "").trim();
    const note = String(holidayNoteInput || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setStatusMessage({ type: "error", text: "Tanggal tidak valid. Gunakan format tanggal (yyyy-mm-dd)." });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3500);
      return;
    }
    if (!note) {
      setStatusMessage({ type: "error", text: "Keterangan wajib diisi." });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3500);
      return;
    }

    setLoading(true);
    setStatusMessage({ type: "", text: "" });
    try {
      await callEduLockSecurityApi("POST", {
        action: "save-holiday",
        schoolId,
        date,
        note,
      });
      setHolidayDateInput("");
      setHolidayNoteInput("");
      setStatusMessage({ type: "success", text: "Hari libur berhasil ditambahkan." });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3000);
    } catch (e: any) {
      setStatusMessage({ type: "error", text: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHoliday = async (date: string) => {
    if (!schoolId) return;
    if (!window.confirm(`Hapus hari libur tanggal ${date}?`)) return;
    setLoading(true);
    setStatusMessage({ type: "", text: "" });
    try {
      await callEduLockSecurityApi("DELETE", {
        action: "delete-holiday",
        schoolId,
        date,
      });
      setStatusMessage({ type: "success", text: "Hari libur dihapus." });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 2500);
    } catch (e: any) {
      setStatusMessage({ type: "error", text: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  };

  const resetDevice = async (nisnValue: string, name: string) => {
    if (!window.confirm(`Reset device binding untuk ${name}? Siswa bisa login di HP baru.`)) return;
    setLoading(true);
    try {
      await callAdminStudentApi("DELETE", {
        action: "reset-device",
        schoolId,
        nisn: nisnValue,
      });
      setStatusMessage({ type: "success", text: `Device UUID untuk ${name} berhasil di-reset.` });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3000);
    } catch (e: any) {
      setStatusMessage({ type: "error", text: `Gagal reset: ${String(e?.message || e)}` });
    } finally {
      setLoading(false);
    }
  };

  const deleteStudent = async (nisnValue: string, name: string) => {
    if (!window.confirm(`HAPUS PERMANEN data siswa ${name}? Data tidak bisa dikembalikan.`)) return;
    setLoading(true);
    try {
      await callAdminStudentApi("DELETE", {
        schoolId,
        nisn: nisnValue,
      });
      setStatusMessage({ type: "success", text: `Data siswa ${name} berhasil dihapus.` });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3000);
    } catch (e: any) {
      setStatusMessage({ type: "error", text: `Gagal hapus: ${String(e?.message || e)}` });
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = () => {
    if (filteredStudents.length === 0) {
      window.alert("Tidak ada data siswa untuk diekspor.");
      return;
    }

    const dataToExport = filteredStudents.map((s) => ({
      NISN: s.nisn,
      Nama: s.name,
      Kelas: s.class,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Siswa");
    XLSX.writeFile(wb, "Data_Siswa_EduLock_Full.xlsx");
  };

  const handleBulkDelete = async () => {
    const keyword = window.prompt(
      "Fitur ini untuk menghapus siswa massal (misal: Siswa Lulus).\n\nMasukkan kata kunci KELAS yang ingin dihapus (Contoh: 'XII' akan menghapus XII IPA 1, XII IPS 2, dst):"
    );
    if (!keyword) return;

    const studentsToDelete = filteredStudents.filter((s) => String(s.class || "").toUpperCase().includes(String(keyword).toUpperCase()));
    if (studentsToDelete.length === 0) {
      window.alert(`Tidak ditemukan siswa dengan kelas mengandung kata '${keyword}'.`);
      return;
    }

    const uniqueClasses = [...new Set(studentsToDelete.map((s) => s.class))].join(", ");
    if (
      !window.confirm(
        `PERINGATAN BAHAYA!\n\nDitemukan ${studentsToDelete.length} siswa dari kelas: [ ${uniqueClasses} ]\n\nApakah Anda yakin ingin MENGHAPUS PERMANEN data mereka? Data yang dihapus tidak bisa dikembalikan.`
      )
    ) {
      return;
    }

    const confirmText = window.prompt(`Ketik 'HAPUS' (huruf besar) untuk mengonfirmasi penghapusan ${studentsToDelete.length} siswa:`);
    if (confirmText !== "HAPUS") {
      window.alert("Penghapusan dibatalkan.");
      return;
    }

    setLoading(true);
    try {
      const result = await callAdminStudentApi("DELETE", {
        action: "delete-class-keyword",
        schoolId,
        classKeyword: keyword,
      });
      const count = Number(result?.data?.count || studentsToDelete.length);
      setStatusMessage({ type: "success", text: `Berhasil menghapus ${count} siswa dari sistem.` });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 4000);
    } catch (error: any) {
      setStatusMessage({ type: "error", text: `Gagal hapus masal: ${String(error?.message || error)}` });
    } finally {
      setLoading(false);
    }
  };

  const isGrade9Class = (value: unknown) => {
    const raw = String(value || "")
      .trim()
      .toUpperCase();
    if (!raw) return false;
    if (/^9\b/.test(raw)) return true;
    if (/^IX\b/.test(raw)) return true;
    if (/^KELAS\s*9\b/.test(raw)) return true;
    if (/^KELAS\s*IX\b/.test(raw)) return true;
    return false;
  };

  const handleBulkUninstallByGrade9 = async (isAuthorized: boolean) => {
    if (!schoolId) {
      setStatusMessage({ type: "error", text: "Sekolah admin belum ter-assign. Hubungi super admin." });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3500);
      return;
    }

    const targets = filteredStudents.filter((s) => isGrade9Class(s.class));
    if (targets.length === 0) {
      setStatusMessage({
        type: "error",
        text: 'Tidak ada siswa Kelas 9 yang terdeteksi (pastikan kolom Kelas diawali "9" atau "IX" dan schoolId sudah terisi).',
      });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 4500);
      return;
    }

    const actionText = isAuthorized ? "MENGIZINKAN" : "MENCABUT";
    if (!window.confirm(`${actionText} UNINSTALL untuk ${targets.length} siswa Kelas 9?`)) return;

    setLoading(true);
    setStatusMessage({ type: "", text: "" });
    try {
      const result = await callEduLockSecurityApi("POST", {
        action: "bulk-grade9-uninstall-auth",
        schoolId,
        isAuthorized,
      });
      const count = Number(result?.data?.count || 0);
      setStatusMessage({ type: "success", text: `Berhasil ${isAuthorized ? "mengizinkan" : "mencabut"} uninstall untuk ${count} siswa Kelas 9.` });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 4000);
    } catch (error: any) {
      setStatusMessage({ type: "error", text: `Gagal update massal: ${String(error?.message || error)}` });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUninstallAuth = (student: StudentRow) => {
    const newStatus = !Boolean(student.uninstall_authorized);
    const actionText = newStatus ? "MENGIZINKAN" : "MENCABUT IZIN";
    if (!window.confirm(`Apakah Anda yakin ingin ${actionText} uninstall aplikasi untuk siswa ${student.name}?`)) return;
    callEduLockSecurityApi("PUT", {
      action: "set-uninstall-auth",
      schoolId,
      nisn: student.nisn,
      isAuthorized: newStatus,
    })
      .then(() => {
        setStatusMessage({ type: "success", text: `Berhasil ${newStatus ? "mengizinkan" : "mencabut izin"} uninstall untuk ${student.name}` });
        setTimeout(() => setStatusMessage({ type: "", text: "" }), 3000);
      })
      .catch((error: any) => {
        setStatusMessage({ type: "error", text: `Gagal mengupdate status: ${String(error?.message || error)}` });
      });
  };

  const handleSaveConfig = async () => {
    if (!schoolId) {
      setStatusMessage({ type: "error", text: "Sekolah admin belum ter-assign. Hubungi super admin." });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3000);
      return;
    }
    setLoading(true);
    try {
      await callEduLockSecurityApi("POST", {
        action: "save-config",
        schoolId,
        config: schoolConfig,
      });
      setStatusMessage({ type: "success", text: "Konfigurasi sekolah berhasil disimpan!" });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3000);
    } catch (error: any) {
      setStatusMessage({ type: "error", text: `Gagal menyimpan: ${String(error?.message || error)}` });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGpsPolicy = async () => {
    if (!schoolId) return;
    const warnMin = Number(gpsWarnMinutes);
    const lockMin = Number(gpsLockMinutes);
    if (!Number.isFinite(warnMin) || warnMin < 0) {
      setStatusMessage({ type: "error", text: "Peringatan GPS (menit) tidak valid." });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3000);
      return;
    }
    if (!Number.isFinite(lockMin) || lockMin < 0) {
      setStatusMessage({ type: "error", text: "Lockdown GPS (menit) tidak valid." });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3000);
      return;
    }
    if (lockMin > 0 && warnMin > lockMin) {
      setStatusMessage({ type: "error", text: "Peringatan GPS harus <= Lockdown GPS." });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3500);
      return;
    }

    setLoading(true);
    try {
      await callEduLockSecurityApi("POST", {
        action: "save-gps-policy",
        schoolId,
        gpsWarnMinutes: warnMin,
        gpsLockMinutes: lockMin,
      });
      setStatusMessage({ type: "success", text: "Kebijakan GPS berhasil disimpan." });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3000);
    } catch (error: any) {
      setStatusMessage({ type: "error", text: `Gagal menyimpan kebijakan GPS: ${String(error?.message || error)}` });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(edulockAuth);
      window.location.href = "/edulock/login";
    } catch (error: any) {
      setStatusMessage({ type: "error", text: `Gagal logout: ${String(error?.message || error)}` });
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 3000);
    }
  };

  const headerTitle = useMemo(() => {
    if (activeTab === "dashboard") return "Dashboard Overview";
    if (activeTab === "monitoring") return "Realtime Student Monitoring";
    if (activeTab === "codes") return "Manajemen Kode Akses";
    if (activeTab === "classes") return "Manajemen Kelas";
    if (activeTab === "violations") return "Audit Log Pelanggaran";
    if (activeTab === "students") return "Manajemen Data Siswa";
    if (activeTab === "geofencing") return "Pengaturan Zona";
    if (activeTab === "settings") return "Pengaturan Sistem & Keamanan";
    return "EduLock";
  }, [activeTab]);

  const todayLabel = useMemo(() => {
    try {
      return new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    } catch {
      return "";
    }
  }, []);

  useEffect(() => {
    const requestedTab = String(searchParams?.get("tab") || "").trim();
    if (!isAdminTab(requestedTab)) return;
    if (requestedTab === activeTab) return;
    setActiveTab(requestedTab);
  }, [activeTab, searchParams]);

  const handleSelectTab = (nextTab: Tab) => {
    setActiveTab(nextTab);
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("tab", nextTab);
    router.replace(`/edulock/admin?${params.toString()}`, { scroll: false });
  };

  return (
    <div
      className="flex h-screen overflow-hidden bg-slate-950 text-white"
      style={{
        backgroundImage:
          "radial-gradient(900px 500px at 15% 10%, rgba(99, 102, 241, 0.18), transparent 60%), radial-gradient(800px 450px at 85% 20%, rgba(16, 185, 129, 0.14), transparent 55%), radial-gradient(900px 500px at 50% 90%, rgba(236, 72, 153, 0.10), transparent 60%)",
      }}
    >
      {mustChangeGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="glass-surface w-full max-w-md p-6">
            <div className="text-lg font-semibold text-white">Wajib Ganti Password</div>
            <div className="mt-1 text-sm text-slate-300">
              Akun admin sekolah menggunakan password default. Demi keamanan, Anda wajib mengganti password sekarang.
            </div>
            <div className="mt-5">
              <label className="label">Password Baru</label>
              <input
                type="password"
                value={forcedPassword}
                onChange={(e) => setForcedPassword(e.target.value)}
                className="input"
                placeholder="Minimal 6 karakter"
              />
              <button type="button" disabled={loading || !forcedPassword} onClick={handleForceChangePassword} className="btn-primary w-full mt-4">
                {loading ? "Memproses..." : "Simpan Password Baru"}
              </button>
              <button type="button" disabled={loading} onClick={handleLogout} className="btn-outline w-full mt-2">
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />}

      <div
        className={`bg-slate-900 text-white w-64 flex-shrink-0 flex flex-col h-full transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } fixed md:relative z-30`}
      >
        <div className="flex min-h-16 items-center justify-center border-b border-slate-800 px-4 py-3">
          <Image
            src="/Logo EduLock.png"
            alt="EduLock"
            width={220}
            height={98}
            className="h-auto w-full max-w-[220px] object-contain"
            priority
          />
          <button className="md:hidden ml-auto" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="border-b border-slate-800 px-4 py-4 text-center">
          <div className="text-sm font-semibold text-slate-100">{adminDisplayName}</div>
          <div className="mt-1 text-xs text-slate-400">{todayLabel}</div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-2">
            <button
              onClick={() => handleSelectTab("dashboard")}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                activeTab === "dashboard" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <LayoutDashboard className="mr-3 h-5 w-5" />
              Dashboard
            </button>

            <button
              onClick={() => handleSelectTab("monitoring")}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                activeTab === "monitoring" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Activity className="mr-3 h-5 w-5" />
              Realtime Monitoring
            </button>

            <button
              onClick={() => handleSelectTab("codes")}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                activeTab === "codes" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <ShieldAlert className="mr-3 h-5 w-5" />
              Kelola Kode Izin
            </button>

            <div className="pt-4 mt-4 border-t border-slate-800">
              <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Administrasi</p>

              <button
                onClick={() => handleSelectTab("geofencing")}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "geofencing" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <MapIcon className="mr-3 h-5 w-5" />
                Pengaturan Zona
              </button>

              <button
                onClick={() => handleSelectTab("students")}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "students" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <UserCog className="mr-3 h-5 w-5" />
                Data Siswa
              </button>

              <button
                onClick={() => handleSelectTab("classes")}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "classes" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Users className="mr-3 h-5 w-5" />
                Manajemen Kelas
              </button>

              <button
                onClick={() => handleSelectTab("violations")}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "violations" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <ShieldAlert className="mr-3 h-5 w-5" />
                Audit Log Pelanggaran
              </button>

              <button
                onClick={() => handleSelectTab("settings")}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "settings" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Settings className="mr-3 h-5 w-5" />
                Pengaturan Sistem
              </button>
            </div>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="w-full flex items-center px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-slate-800 rounded-md transition-colors">
            <LogOut className="mr-3 h-5 w-5" />
            Keluar
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col w-full">
        <header className="glass-header h-16 flex items-center justify-between px-6 z-10">
          <div className="flex items-center">
            <button className="md:hidden mr-4 text-slate-300 hover:text-white" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-semibold text-white">{headerTitle}</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/admin" className="btn-outline px-3 py-2 text-sm">
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Dashboard Satu Pintu
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {statusMessage.text && (
              <div className={`${statusMessage.type === "error" ? "callout-error" : "callout-success"} flex justify-between items-center animate-fade-in-down`}>
                <span>{statusMessage.text}</span>
                <button onClick={() => setStatusMessage({ type: "", text: "" })}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {activeTab === "dashboard" && (
              <>
                <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-indigo-600/70 via-fuchsia-600/40 to-emerald-500/30 p-6 text-white mb-6 relative overflow-hidden">
                  <div className="relative z-10">
                    <h2 className="text-2xl font-bold mb-2">Selamat Datang, {adminDisplayName}</h2>
                    <p className="text-white/75">Pantau aktivitas siswa dan kelola keamanan perangkat dengan mudah dan realtime.</p>
                  </div>
                  <div className="absolute right-0 bottom-0 opacity-10 transform translate-y-1/4 translate-x-1/4">
                    <ShieldAlert className="w-48 h-48" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="glass-surface-sm p-6 transition-transform hover:scale-[1.01] duration-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-400">Siswa Online</p>
                        <p className="text-3xl font-bold text-white mt-1">{stats.online}</p>
                      </div>
                      <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                        <Wifi className="h-6 w-6 text-indigo-200" />
                      </div>
                    </div>
                  </div>
                  <div className="glass-surface-sm p-6 transition-transform hover:scale-[1.01] duration-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-400">Siswa Di Luar Zona</p>
                        <p className="text-3xl font-bold text-rose-200 mt-1">{stats.outside}</p>
                      </div>
                      <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                        <MapPin className="h-6 w-6 text-rose-200" />
                      </div>
                    </div>
                  </div>
                  <div className="glass-surface-sm p-6 transition-transform hover:scale-[1.01] duration-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-400">Sesi Aktif</p>
                        <p className="text-3xl font-bold text-emerald-200 mt-1">{filteredSessions.length}</p>
                      </div>
                      <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                        <Users className="h-6 w-6 text-emerald-200" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="glass-surface overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                      <h3 className="font-semibold text-white">Buat Kode Izin Cepat</h3>
                      <ShieldAlert className="h-5 w-5 text-slate-400" />
                    </div>
                    <div className="p-6">
                      <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="w-full">
                          <label className="label">Jam Mulai</label>
                          <input type="time" value={startTimeInput} onChange={(e) => setStartTimeInput(e.target.value)} className="input" />
                        </div>
                        <div className="w-full">
                          <label className="label">Jam Akhir</label>
                          <input type="time" value={endTimeInput} onChange={(e) => setEndTimeInput(e.target.value)} className="input" />
                        </div>
                        <button onClick={handleCreateCode} disabled={loading} className="btn-primary w-full sm:w-auto px-5 py-2.5">
                          {loading ? "Memproses..." : (
                            <>
                              <Plus className="w-4 h-4 mr-2" /> Generate
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="glass-surface overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                      <h3 className="font-semibold text-white">Sesi Aktif Terkini</h3>
                      <span className="chip chip-emerald">{filteredSessions.length}</span>
                    </div>
                    <div className="divide-y divide-white/10 max-h-[300px] overflow-y-auto">
                      {filteredSessions.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-sm">Tidak ada sesi aktif.</div>
                      ) : (
                        filteredSessions.slice(0, 5).map((session) => (
                          <div key={session.nisn} className="p-4 flex items-center justify-between hover:bg-white/5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-200 font-bold text-xs">
                                {(session.name || session.nisn).charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-white truncate max-w-[160px]">{session.name || session.nisn}</p>
                                <p className="text-xs text-slate-400">{session.endTime ? `${Math.ceil((Number(session.endTime) - Date.now()) / 60000)}m left` : "-"}</p>
                              </div>
                            </div>
                            <button onClick={() => handleRevokeSession(session.nisn, session.name || session.nisn)} className="text-xs text-rose-200 hover:text-rose-100 font-semibold">
                              Revoke
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === "monitoring" && (
              <div className="glass-surface overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                  <div>
                    <h3 className="font-semibold text-white">Data Realtime Siswa</h3>
                    <div className="text-xs text-slate-400 mt-1">
                      Menampilkan: {monitoringClassFilterKey === "all" ? "Semua Kelas" : classByKey.get(monitoringClassFilterKey)?.name || monitoringClassFilterKey} • Total: {monitoringStudents.length} siswa
                    </div>
                  </div>
                  <button onClick={() => window.location.reload()} className="text-indigo-200 text-sm font-semibold hover:text-indigo-100">
                    Refresh Data
                  </button>
                </div>
                <div className="px-6 py-4 border-b border-white/10 bg-white/5">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:items-end">
                    <div className="w-full">
                      <label className="label">Filter Kelas</label>
                      <select value={monitoringClassFilterKey} onChange={(e) => setMonitoringClassFilterKey(e.target.value)} className="input">
                        <option value="all">Semua Kelas</option>
                        {classCatalogComputed.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-slate-400 mt-1">Kelas mengikuti Database (GAS).</div>
                    </div>
                    <div className="w-full lg:col-span-2">
                      <label className="label">Cabut Izin Massal (Kelas)</label>
                      <input
                        type="text"
                        value={bulkRevokeClassesText}
                        onChange={(e) => setBulkRevokeClassesText(e.target.value)}
                        className="input"
                        placeholder="Contoh: 7A,7B,8A,8D,9C,9F,9G"
                      />
                      <div className="text-xs text-slate-400 mt-1">Pisahkan dengan koma. Format fleksibel: VII-A, VII A, atau 7A.</div>
                    </div>
                    <button
                      onClick={handleBulkRevokeByClasses}
                      disabled={loading}
                      className="btn-danger w-full lg:w-auto px-6 py-2.5"
                      title="Cabut izin penggunaan HP untuk semua siswa di kelas yang dipilih"
                    >
                      <Lock className="w-4 h-4 mr-2" /> Cabut Izin Massal
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="table-premium">
                    <thead>
                      <tr>
                        <th className="px-6 py-3">Siswa</th>
                        <th className="px-6 py-3">Status Monitoring</th>
                        <th className="px-6 py-3">Lokasi</th>
                        <th className="px-6 py-3">Trust Score</th>
                        <th className="px-6 py-3">Last Update</th>
                        <th className="px-6 py-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitoringStudents.map((student) => {
                        const isActiveSession = filteredSessions.some((session) => session.nisn === student.nisn);
                        const lastSeenDiff = Date.now() - Number(student.lastUpdated || 0);
                        const isOnline = student.deviceStatus === "Online" || lastSeenDiff < 5 * 60 * 1000;

                        let statusPillClass = "chip";
                        let statusDot = "bg-slate-400";
                        let statusText = "Offline";

                        if (isOnline) {
                          if (student.isInsideZone) {
                            statusPillClass = "chip chip-emerald";
                            statusDot = "bg-emerald-400";
                            statusText = "Aman (Di Sekolah)";
                          } else {
                            statusPillClass = "chip chip-amber";
                            statusDot = "bg-amber-400";
                            statusText = "Warning (Luar Zona)";
                          }
                        } else {
                          statusPillClass = "chip chip-rose";
                          statusDot = "bg-rose-400";
                          statusText = "Offline / Inactive";
                        }

                        const trustScore = Number(student.trustScore ?? 0) || 0;

                        return (
                          <tr key={student.nisn} className={isOnline && student.isInsideZone ? "bg-emerald-500/10" : ""}>
                            <td className="px-6 py-4 font-medium text-white whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                                    isOnline && student.isInsideZone ? "bg-green-500" : "bg-blue-400"
                                  }`}
                                >
                                  {student.name ? student.name.charAt(0) : "?"}
                                </div>
                                <div>
                                  <div>{student.name || "-"}</div>
                                  <div className="text-xs text-slate-400">{student.class || "-"}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                <span className={`${statusPillClass} inline-flex items-center w-fit`}>
                                  <span className={`w-2 h-2 mr-1.5 rounded-full ${statusDot} animate-pulse`} />
                                  {statusText}
                                </span>
                                <span className="text-xs text-slate-400 truncate max-w-[220px]">{student.statusMessage || "-"}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1.5">
                                <MapPin className={`w-4 h-4 ${!isOnline ? "text-slate-500" : student.isInsideZone ? "text-emerald-300" : "text-rose-300"}`} />
                                <span className={!isOnline ? "text-slate-500" : student.isInsideZone ? "text-slate-200" : "text-rose-200 font-medium"}>
                                  {!isOnline ? "-" : student.isInsideZone ? "Di Sekolah" : "Luar Zona"}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="w-full bg-white/10 rounded-full h-2.5 max-w-[100px] mb-1">
                                <div
                                  className={`h-2.5 rounded-full ${
                                    trustScore > 70 ? "bg-green-500" : trustScore > 40 ? "bg-yellow-500" : "bg-red-500"
                                  }`}
                                  style={{ width: `${Math.max(0, Math.min(100, trustScore))}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium">{trustScore}%</span>
                            </td>
                            <td className="px-6 py-4 text-xs">
                              <div className="flex flex-col">
                                <span>{formatTime(student.lastUpdated)}</span>
                                <span className="text-[10px] text-slate-400">
                                  {student.lastUpdated ? `${Math.round((Date.now() - Number(student.lastUpdated)) / 1000 / 60)} min ago` : "Never"}
                                </span>
                              </div>
                              {student.lastUpdated && Date.now() - Number(student.lastUpdated) > 5 * 60 * 1000 && (
                                <span className="block text-rose-200 font-bold mt-1">Stale Data</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              {isActiveSession ? (
                                <button
                                  onClick={() => handleRevokeSession(student.nisn, student.name || student.nisn)}
                                  className="btn-danger text-xs px-3 py-1.5 mx-auto"
                                  title="Batalkan Izin Penggunaan HP"
                                >
                                  <Lock className="w-3 h-3 mr-1" /> Cabut Izin
                                </button>
                              ) : (
                                <span className="text-slate-500 text-xs italic">Terkunci</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {monitoringStudents.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                            Belum ada data monitoring siswa.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "classes" && (
              <div className="space-y-6">
                <div className="glass-surface overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/10 bg-white/5">
                    <h3 className="font-semibold text-white flex items-center">
                      <Users className="w-5 h-5 mr-2 text-indigo-200" />
                      Manajemen Kelas
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                      Data kelas mengikuti Database Satu Pintu (GAS).
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link
                          href="/admin/students?sub=classes"
                          className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
                        >
                          Kelola Kelas di Database
                        </Link>
                      </div>
                    </div>

                    <div className="mt-6 overflow-x-auto">
                      <table className="table-premium">
                        <thead>
                          <tr>
                            <th className="px-6 py-3">Kelas</th>
                            <th className="px-6 py-3">Key</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classCatalogComputed.map((c) => (
                            <tr key={c.key}>
                              <td className="px-6 py-4 font-medium text-white">{c.name}</td>
                              <td className="px-6 py-4 font-mono text-xs text-slate-400">{c.key}</td>
                            </tr>
                          ))}
                          {classCatalogComputed.length === 0 && (
                            <tr>
                              <td colSpan={2} className="px-6 py-8 text-center text-slate-400 italic">
                                Belum ada kelas. Tambahkan kelas agar input siswa dan filter lebih rapi.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "codes" && (
              <div className="space-y-6">
                <div className="glass-surface p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Generate Kode Baru</h3>
                  <div className="grid gap-4 md:grid-cols-3 items-end">
                    <div>
                      <label className="label">Jam Mulai</label>
                      <input type="time" value={startTimeInput} onChange={(e) => setStartTimeInput(e.target.value)} className="input" />
                    </div>
                    <div>
                      <label className="label">Jam Akhir</label>
                      <input type="time" value={endTimeInput} onChange={(e) => setEndTimeInput(e.target.value)} className="input" />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleCreateCode} disabled={loading} className="btn-primary w-full">
                        {loading ? "Memproses..." : (
                          <>
                            <Plus className="w-5 h-5" /> Generate Kode
                          </>
                        )}
                      </button>
                      <button type="button" onClick={handleDeleteExpiredCodes} disabled={loading} className="btn-outline">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="glass-surface overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                    <h3 className="font-semibold text-white">Daftar Kode Aktif</h3>
                    <span className="chip chip-indigo">{filteredCodes.length}</span>
                  </div>
                  <div className="divide-y divide-white/10">
                    {filteredCodes.length === 0 ? (
                      <div className="p-6 text-center text-slate-400">Tidak ada kode aktif saat ini.</div>
                    ) : (
                      filteredCodes.map((item: any) => (
                        <div key={item.code} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/5">
                          <div className="flex items-center gap-5">
                            <div className="bg-white p-2 rounded-xl">
                              <QRCode value={String(item.code)} size={88} />
                            </div>
                            <div>
                              <div className="text-xl font-bold tracking-widest text-white">{item.code}</div>
                              <div className="text-sm text-slate-300 mt-1">
                                {item.sessionStart || "-"} - {item.sessionEnd || "-"} • {item.duration ? `${item.duration} menit` : "-"}
                              </div>
                              <div className="text-xs text-slate-400 mt-1">
                                Expired: {item.expiresAt ? new Date(item.expiresAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}
                              </div>
                              {isExpired(item.expiresAt) && <div className="text-xs text-rose-200 font-semibold mt-1">Expired</div>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => handleDeleteCode(String(item.code))} className="btn-danger">
                              <Trash2 className="w-4 h-4" /> Hapus
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "violations" && (
              <div className="glass-surface overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 bg-white/5">
                  <h3 className="font-semibold text-white flex items-center">
                    <ShieldAlert className="w-5 h-5 mr-2 text-indigo-200" />
                    Audit Log Pelanggaran
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="table-premium">
                    <thead>
                      <tr>
                        <th className="px-6 py-3">Waktu</th>
                        <th className="px-6 py-3">Siswa</th>
                        <th className="px-6 py-3">Tipe</th>
                        <th className="px-6 py-3">Keterangan</th>
                        <th className="px-6 py-3">Lokasi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredViolations.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 text-center text-slate-400 italic">
                            Belum ada data pelanggaran yang tercatat.
                          </td>
                        </tr>
                      ) : (
                        filteredViolations.map((log: any) => {
                          const student = filteredStudents.find((s) => s.nisn === String(log.nisn));
                          const studentName = student ? student.name : log.nisn;
                          const studentClass = student ? student.class : "-";
                          return (
                            <tr key={log.id}>
                              <td className="px-6 py-4 whitespace-nowrap">{log.timestamp ? new Date(log.timestamp).toLocaleString("id-ID") : "-"}</td>
                              <td className="px-6 py-4">
                                <div className="font-medium text-white">{studentName}</div>
                                <div className="text-xs text-slate-400">
                                  {studentClass} ({log.nisn})
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`chip ${log.type === "EMERGENCY_UNLOCK" ? "chip-rose" : log.type === "ADMIN_DEACTIVATED" ? "chip-amber" : "chip-amber"}`}>
                                  {String(log.type || "-")}
                                </span>
                              </td>
                              <td className="px-6 py-4">{String(log.description || "-")}</td>
                              <td className="px-6 py-4">
                                {log.latitude && log.longitude ? (
                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${log.latitude},${log.longitude}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-indigo-200 hover:text-indigo-100 flex items-center font-semibold"
                                  >
                                    <MapPin className="w-4 h-4 mr-1" />
                                    Lihat Peta
                                  </a>
                                ) : (
                                  <span className="text-slate-500">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "students" && (
              <div className="glass-surface overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                  <h3 className="font-semibold text-white flex items-center">
                    <UserCog className="w-5 h-5 mr-2 text-indigo-200" />
                    Manajemen Data Siswa
                  </h3>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="text-sm text-slate-400 mr-2 hidden lg:block">Total: {filteredStudents.length} Siswa</span>

                    <button onClick={handleExportData} className="btn-outline px-3 py-2 text-sm" title="Export Data Siswa ke Excel">
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Export</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleBulkDelete}
                      disabled={loading}
                      className="btn-danger px-3 py-2 text-sm"
                      title="Hapus siswa massal berdasarkan kata kunci kelas"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Hapus Massal</span>
                    </button>

                    <button onClick={() => handleBulkUninstallByGrade9(true)} className="btn-success px-3 py-2 text-sm" title="Izinkan Uninstall Massal untuk Kelas 9 (lulus)" disabled={loading}>
                      <Unlock className="w-4 h-4" />
                      <span className="hidden sm:inline">Uninstall Kls 9</span>
                    </button>

                    <button onClick={() => handleBulkUninstallByGrade9(false)} className="btn-danger px-3 py-2 text-sm" title="Cabut Izin Uninstall Massal untuk Kelas 9" disabled={loading}>
                      <Lock className="w-4 h-4" />
                      <span className="hidden sm:inline">Cabut Kls 9</span>
                    </button>
                  </div>
                </div>

                <div className="px-6 py-4 border-b border-white/10 bg-white/5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                      <label className="label">Filter Kelas</label>
                      <select value={studentClassFilterKey} onChange={(e) => setStudentClassFilterKey(e.target.value)} className="input">
                        <option value="all">Semua Kelas</option>
                        {classCatalogComputed.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2 text-sm text-slate-400">
                      Daftar kelas mengikuti Database (GAS). Jika belum ada, filter hanya menampilkan Semua Kelas.
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="table-premium">
                    <thead>
                      <tr>
                        <th className="px-6 py-3">NISN</th>
                        <th className="px-6 py-3">Nama Lengkap</th>
                        <th className="px-6 py-3">Kelas</th>
                        <th className="px-6 py-3">Device ID (UUID)</th>
                        <th className="px-6 py-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents
                        .filter((student) => {
                          if (studentClassFilterKey === "all") return true;
                          const key = String((student as any)?.classKey || normalizeClassKey(student.class)).trim();
                          return key === studentClassFilterKey;
                        })
                        .map((student) => (
                        <tr key={student.nisn}>
                          <td className="px-6 py-4 font-mono text-xs">{student.nisn}</td>
                          <td className="px-6 py-4 font-medium text-white">{student.name}</td>
                          <td className="px-6 py-4">
                            {(() => {
                              const key = String((student as any)?.classKey || normalizeClassKey(student.class)).trim();
                              const label = key && classByKey.has(key) ? classByKey.get(key)?.name : student.class;
                              return label || "-";
                            })()}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-400 max-w-[150px] truncate" title={String(student.device_uuid || "")}>
                            {student.device_uuid || <span className="text-amber-200 italic">Belum Binding</span>}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center space-x-2">
                              <button
                                onClick={() => handleToggleUninstallAuth(student)}
                                title={student.uninstall_authorized ? "Cabut Izin Uninstall" : "Izinkan Uninstall Aplikasi"}
                                className={`p-2 rounded-lg transition-colors ${
                                  student.uninstall_authorized
                                    ? "text-fuchsia-200 bg-fuchsia-500/15 border border-fuchsia-500/20 hover:bg-fuchsia-500/20"
                                    : "text-slate-400 hover:bg-white/10 hover:text-fuchsia-200"
                                }`}
                              >
                                {student.uninstall_authorized ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => resetDevice(student.nisn, student.name || student.nisn)}
                                title="Reset Device Binding"
                                className="p-2 text-amber-200 hover:bg-white/10 rounded-lg transition-colors"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteStudent(student.nisn, student.name || student.nisn)}
                                title="Hapus siswa"
                                className="p-2 text-rose-200 hover:bg-white/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredStudents.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">
                            Belum ada data siswa yang terdaftar.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "geofencing" && (
              <div className="space-y-6">
                <div className="glass-surface overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/10 bg-white/5">
                    <h3 className="font-semibold text-white flex items-center">
                      <MapIcon className="w-5 h-5 mr-2 text-indigo-200" />
                      Konfigurasi Lokasi Sekolah
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <label className="label">Koordinat Sekolah (Latitude, Longitude)</label>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <input
                              type="number"
                              step="any"
                              placeholder="Latitude (contoh: -6.200000)"
                              className="input"
                              value={String(schoolConfig.latitude ?? "")}
                              onChange={(e) => setSchoolConfig((prev: any) => ({ ...prev, latitude: e.target.value }))}
                            />
                          </div>
                          <div>
                            <input
                              type="number"
                              step="any"
                              placeholder="Longitude (contoh: 106.816666)"
                              className="input"
                              value={String(schoolConfig.longitude ?? "")}
                              onChange={(e) => setSchoolConfig((prev: any) => ({ ...prev, longitude: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 mb-6">
                          Tips: Buka Google Maps, klik kanan pada lokasi sekolah, lalu salin koordinatnya.
                        </div>

                        <label className="label">Radius Aman (Meter)</label>
                        <input
                          type="number"
                          className="input mb-2"
                          value={String(schoolConfig.radius ?? "")}
                          onChange={(e) => setSchoolConfig((prev: any) => ({ ...prev, radius: Number(e.target.value || 0) }))}
                        />
                        <div className="text-xs text-slate-400 mb-6">
                          Jarak toleransi dari titik pusat sekolah. Siswa dianggap Keluar Zona jika berada di luar radius ini.
                        </div>

                        <button type="button" onClick={handleSaveConfig} disabled={loading} className="btn-primary w-full md:w-auto px-5 py-2.5">
                          {loading ? (
                            "Menyimpan..."
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" /> Simpan Konfigurasi
                            </>
                          )}
                        </button>
                      </div>

                      <div className="glass-surface-sm p-6 flex flex-col items-center justify-center text-center">
                        <MapPin className="w-16 h-16 text-slate-400 mb-4" />
                        <div className="text-white font-medium mb-2">Preview Peta</div>
                        <div className="text-sm text-slate-400 mb-4">
                          Pastikan koordinat yang Anda masukkan sudah benar sesuai lokasi sekolah.
                        </div>
                        {schoolConfig.latitude && schoolConfig.longitude ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${schoolConfig.latitude},${schoolConfig.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-200 hover:text-indigo-100 text-sm font-semibold flex items-center"
                          >
                            Buka di Google Maps <MapPin className="w-3 h-3 ml-1" />
                          </a>
                        ) : (
                          <span className="text-slate-500 text-sm italic">Belum ada koordinat</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "settings" && (
              <div className="space-y-6">
                <div className="glass-surface overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/10 bg-white/5">
                    <h3 className="font-semibold text-white flex items-center">
                      <Settings className="w-5 h-5 mr-2 text-indigo-200" />
                      Pengaturan Sistem & Keamanan
                    </h3>
                  </div>
                  <div className="p-6 space-y-8">
                    <div>
                      <h4 className="text-base font-medium text-white mb-4 flex items-center">
                        <Clock className="w-4 h-4 mr-2 text-slate-400" />
                        Jam Operasional Sekolah
                      </h4>

                      <div className="mb-6 bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20 flex items-center justify-between">
                        <div>
                          <h5 className="font-semibold text-white flex items-center">
                            <ShieldAlert className="w-4 h-4 mr-2" />
                            Status Proteksi Sekolah (Master Switch)
                          </h5>
                          <p className="text-sm text-indigo-100/80 mt-1">
                            Matikan tombol ini untuk Mode Senyap (Fase Instalasi). Saat MATI, aplikasi tidak akan mengunci HP siswa.
                            <br />
                            Nyalakan saat semua siswa sudah menginstall aplikasi.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={Boolean(schoolConfig.is_active_protection)}
                            onChange={(e) => {
                              if (!schoolId) return;
                              const newState = e.target.checked;
                              setSchoolConfig((prev: any) => ({ ...prev, is_active_protection: newState }));
                              callEduLockSecurityApi("PUT", {
                                action: "set-config-flag",
                                schoolId,
                                flag: "is_active_protection",
                                value: newState,
                              })
                                .then(() =>
                                  setStatusMessage({
                                    type: "success",
                                    text: newState ? "Proteksi Sekolah AKTIF" : "Proteksi Sekolah NONAKTIF (Silent Mode)",
                                  })
                                )
                                .catch((err: any) => setStatusMessage({ type: "error", text: String(err?.message || err) }));
                            }}
                          />
                          <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/25 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>

                      <div className="mb-6 bg-fuchsia-500/10 p-4 rounded-xl border border-fuchsia-500/20 flex items-center justify-between">
                        <div>
                          <h5 className="font-semibold text-white flex items-center">
                            <Activity className="w-4 h-4 mr-2" />
                            Mode Acara / Libur Sekolah
                          </h5>
                          <p className="text-sm text-fuchsia-100/80 mt-1">
                            Aktifkan mode ini saat acara sekolah agar siswa bisa menggunakan HP bebas tanpa monitoring.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={Boolean(schoolConfig.is_holiday_mode)}
                            onChange={(e) => {
                              if (!schoolId) return;
                              const newState = e.target.checked;
                              setSchoolConfig((prev: any) => ({ ...prev, is_holiday_mode: newState }));
                              callEduLockSecurityApi("PUT", {
                                action: "set-config-flag",
                                schoolId,
                                flag: "is_holiday_mode",
                                value: newState,
                              })
                                .then(() => setStatusMessage({ type: "success", text: newState ? "Mode Libur / Acara AKTIF" : "Mode Libur / Acara NONAKTIF" }))
                                .catch((err: any) => setStatusMessage({ type: "error", text: String(err?.message || err) }));
                            }}
                          />
                          <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-fuchsia-500/25 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-fuchsia-600"></div>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
                        <div className="glass-surface-sm min-w-0 p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <div className="text-sm font-semibold text-white">Jadwal & Hari Efektif</div>
                              <div className="text-xs text-slate-400 mt-1">Atur hari masuk sekolah dan jam operasional per-hari.</div>
                            </div>
                            <button type="button" onClick={handleSaveWeekdaySchedule} disabled={loading} className="btn-primary px-4 py-2 text-sm">
                              <Save className="w-4 h-4 mr-2" />
                              Simpan
                            </button>
                          </div>

                          <div className="space-y-2">
                            {WEEKDAY_ROWS.map((d) => {
                              const row = weekdaySchedule[d.key];
                              return (
                                <div key={d.key} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                                  <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(row.enabled)}
                                      onChange={(e) =>
                                        setWeekdaySchedule((prev) => ({
                                          ...prev,
                                          [d.key]: { ...prev[d.key], enabled: e.target.checked },
                                        }))
                                      }
                                      className="h-4 w-4 accent-indigo-500"
                                    />
                                    <div className="font-medium text-white">{d.label}</div>
                                  </div>
                                  <div className="grid shrink-0 grid-cols-[34px_96px_42px_96px] items-center gap-2">
                                    <div className="text-[10px] text-slate-400 uppercase tracking-wider text-right">Masuk</div>
                                    <input
                                      type="time"
                                      value={String(row.start || "")}
                                      disabled={!row.enabled}
                                      onChange={(e) =>
                                        setWeekdaySchedule((prev) => ({
                                          ...prev,
                                          [d.key]: { ...prev[d.key], start: e.target.value },
                                        }))
                                      }
                                      className={`input py-2 px-2 w-24 ${row.enabled ? "" : "opacity-60"}`}
                                    />
                                    <div className="text-[10px] text-slate-400 uppercase tracking-wider text-right">Pulang</div>
                                    <input
                                      type="time"
                                      value={String(row.end || "")}
                                      disabled={!row.enabled}
                                      onChange={(e) =>
                                        setWeekdaySchedule((prev) => ({
                                          ...prev,
                                          [d.key]: { ...prev[d.key], end: e.target.value },
                                        }))
                                      }
                                      className={`input py-2 px-2 w-24 ${row.enabled ? "" : "opacity-60"}`}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="text-xs text-slate-400 mt-4">
                            Jam Masuk/Pulang akan digunakan sebagai patokan waktu sekolah dan penguncian EduLock.
                          </div>
                        </div>

                        <div className="glass-surface-sm p-6 lg:w-[320px] xl:w-[340px] lg:justify-self-end">
                          <div className="text-sm font-semibold text-white">Hari Libur & Tanggal Merah</div>
                          <div className="text-xs text-slate-400 mt-1">Tambahkan tanggal libur agar EduLock otomatis bebas pada hari tersebut.</div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end mt-4">
                            <div>
                              <label className="label">Tanggal</label>
                              <input type="date" value={holidayDateInput} onChange={(e) => setHolidayDateInput(e.target.value)} className="input" />
                            </div>
                            <div className="md:col-span-2">
                              <label className="label">Keterangan</label>
                              <input
                                type="text"
                                value={holidayNoteInput}
                                onChange={(e) => setHolidayNoteInput(e.target.value)}
                                className="input"
                                placeholder="Contoh: Hari Kemerdekaan RI"
                              />
                            </div>
                          </div>

                          <div className="mt-3 flex justify-end">
                            <button type="button" onClick={handleAddHoliday} disabled={loading} className="btn-primary px-5 py-2.5 text-sm">
                              <Plus className="w-4 h-4 mr-2" />
                              Tambah
                            </button>
                          </div>

                          <div className="mt-4">
                            {holidayList.length === 0 ? (
                              <div className="text-center text-slate-500 text-sm italic py-6">Belum ada data hari libur</div>
                            ) : (
                              <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/5">
                                {holidayList.map((h) => (
                                  <div key={h.date} className="flex items-center justify-between gap-4 px-4 py-3">
                                    <div>
                                      <div className="text-sm font-semibold text-white">{h.date}</div>
                                      <div className="text-xs text-slate-300">{h.note || "-"}</div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteHoliday(h.date)}
                                      disabled={loading}
                                      className="p-2 text-rose-200 hover:bg-white/10 rounded-lg transition-colors"
                                      title="Hapus"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div className="md:col-span-2 glass-surface-sm p-6">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="text-sm font-semibold text-white">Kebijakan GPS Mati</div>
                              <div className="text-xs text-slate-400 mt-1">
                                Berlaku saat jam sekolah dan siswa terdeteksi di zona sekolah. Set 0 menit untuk lockdown langsung.
                              </div>
                            </div>
                            <button type="button" disabled={loading} onClick={handleSaveGpsPolicy} className="btn-primary px-5 py-2.5 text-sm whitespace-nowrap">
                              <Save className="w-4 h-4 mr-2" />
                              Simpan
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div>
                              <label className="label">Peringatan (menit)</label>
                              <input
                                type="number"
                                min={0}
                                value={String(gpsWarnMinutes)}
                                onChange={(e) => setGpsWarnMinutes(Math.max(0, Number(e.target.value || 0)))}
                                className="input"
                              />
                            </div>
                            <div>
                              <label className="label">Lockdown (menit)</label>
                              <input
                                type="number"
                                min={0}
                                value={String(gpsLockMinutes)}
                                onChange={(e) => setGpsLockMinutes(Math.max(0, Number(e.target.value || 0)))}
                                className="input"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="label">Latitude</label>
                          <input value={String(schoolConfig.latitude || "")} onChange={(e) => setSchoolConfig((p: any) => ({ ...p, latitude: e.target.value }))} className="input" />
                        </div>
                        <div>
                          <label className="label">Longitude</label>
                          <input value={String(schoolConfig.longitude || "")} onChange={(e) => setSchoolConfig((p: any) => ({ ...p, longitude: e.target.value }))} className="input" />
                        </div>
                        <div>
                          <label className="label">Radius (meter)</label>
                          <input
                            type="number"
                            value={String(schoolConfig.radius ?? 0)}
                            onChange={(e) => setSchoolConfig((p: any) => ({ ...p, radius: Number(e.target.value || 0) }))}
                            className="input"
                          />
                        </div>
                        <div className="flex items-end">
                          <button type="button" disabled={loading} onClick={handleSaveConfig} className="btn-primary w-full">
                            <Key className="w-4 h-4" />
                            Simpan Konfigurasi
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="glass-surface-sm p-6">
                        <h5 className="font-semibold text-white mb-2">Kode Uninstall (Sekolah)</h5>
                        <p className="text-sm text-slate-300">
                          Kode ini dibuat oleh Super Admin dan hanya berlaku sebentar. Gunakan kode ini (atau scan QR) untuk mengakses Uninstall.
                        </p>
                        <div className="mt-4">
                          <div className="text-2xl font-bold tracking-widest text-white">
                            {uninstallAccess?.code && uninstallAccess?.expiresAt && uninstallAccess.expiresAt > Date.now()
                              ? uninstallAccess.code
                              : "-"}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {uninstallAccess?.code && uninstallAccess?.expiresAt && uninstallAccess.expiresAt > Date.now()
                              ? `Berlaku sampai ${new Date(uninstallAccess.expiresAt).toLocaleString("id-ID")}`
                              : "Belum ada kode aktif. Minta Super Admin untuk membuat Kode Uninstall sekolah."}
                          </div>
                        </div>
                        <div className="mt-4">
                          {uninstallAccess?.code && uninstallAccess?.expiresAt && uninstallAccess.expiresAt > Date.now() ? (
                            <div className="bg-white p-3 rounded-2xl inline-block">
                              <QRCode value={String(uninstallAccess.code)} size={128} />
                            </div>
                          ) : null}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

    </div>
  );
}
