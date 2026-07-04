"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, List, Printer } from "lucide-react";
import { usePrayerStore } from "@/store/usePrayerStore";
import { useStudentStore } from "@/store/useStudentStore";
import { useClassStore } from "@/store/useClassStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useTeacherStore } from "@/store/useTeacherStore";
import type { Student } from "@/types/student";
import { useAttendanceStore } from "@/store/useAttendanceStore";
import { createStudentDateKey, getValidDatesInMonth, pickNewestLog, toDateKey } from "@/utils/presensiRules";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

function isNonMuslimStudent(student: Student) {
  const religion = String((student as any)?.religion || (student as any)?.agama || "").trim().toLowerCase();
  if (!religion) return false;
  if (religion === "non_islam" || religion === "non-islam" || religion === "non muslim" || religion === "nonmuslim") return true;
  if (religion.includes("non") && religion.includes("islam")) return true;
  if (religion.includes("kristen") || religion.includes("katolik") || religion.includes("hindu") || religion.includes("buddha") || religion.includes("konghucu")) return true;
  return false;
}

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeIdentity(value: unknown) {
  return String(value || "").trim();
}

function getStudentIdentityCandidates(student?: Partial<Student> | null) {
  if (!student) return [];

  return [
    normalizeIdentity(student.id),
    normalizeIdentity(student.nisn),
  ].filter((value, index, array) => value && array.indexOf(value) === index);
}

function getSessionIdentityCandidates(user: { id?: string; nisn?: string } | null | undefined) {
  if (!user) return [];

  return [
    normalizeIdentity(user.id),
    normalizeIdentity(user.nisn),
  ].filter((value, index, array) => value && array.indexOf(value) === index);
}

function matchesStudentSession(student: Student, user: { id?: string; nisn?: string } | null | undefined) {
  const sessionIdentities = getSessionIdentityCandidates(user);
  if (sessionIdentities.length === 0) return false;

  return getStudentIdentityCandidates(student).some((candidate) => sessionIdentities.includes(candidate));
}

function normalizeClass(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function compareClassNames(a: string, b: string) {
  const gradeFrom = (name: string) => {
    const raw = normalizeClass(name);
    if (raw.startsWith("VIII")) return 8;
    if (raw.startsWith("VII")) return 7;
    if (raw.startsWith("IX")) return 9;
    const compact = raw.replace(/\s+/g, "").replace(/-/g, "");
    if (compact.startsWith("7")) return 7;
    if (compact.startsWith("8")) return 8;
    if (compact.startsWith("9")) return 9;
    return 999;
  };

  const suffixFrom = (name: string) => {
    const raw = normalizeClass(name);
    const matchRoman = raw.match(/^(VIII|VII|IX)\s*[- ]?\s*(.*)$/);
    if (matchRoman) return String(matchRoman[2] || "").trim();
    const compact = raw.replace(/\s+/g, "").replace(/-/g, "");
    const matchNumeric = compact.match(/^(7|8|9)(.*)$/);
    if (matchNumeric) return String(matchNumeric[2] || "").trim();
    return raw;
  };

  const gradeA = gradeFrom(a);
  const gradeB = gradeFrom(b);
  if (gradeA !== gradeB) return gradeA - gradeB;

  const suffixA = suffixFrom(a);
  const suffixB = suffixFrom(b);
  if (!suffixA && suffixB) return -1;
  if (suffixA && !suffixB) return 1;
  return suffixA.localeCompare(suffixB, "id-ID", { numeric: true, sensitivity: "base" });
}

function formatPrayerTime(timestamp?: number | null) {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).replace(".", ":");
}

const STATUS_LABELS: Record<string, string> = {
  PRAY: "Sholat",
  NOT_PRAY: "Tidak Sholat",
  PERMIT: "Izin",
  HALANGAN: "Pengecualian",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  PRAY: "bg-green-900/30 text-green-400 border border-green-700/30",
  NOT_PRAY: "bg-red-900/30 text-red-400 border border-red-700/30",
  PERMIT: "bg-blue-900/30 text-blue-400 border border-blue-700/30",
  HALANGAN: "bg-purple-900/30 text-purple-400 border border-purple-700/30",
};

const HIDE_RECORDED_TIME_STATUSES = new Set(["NOT_PRAY", "PERMIT", "HALANGAN"]);

function getDisplayPrayerTime(status: string | undefined, timestamp?: number | null) {
  if (!status || HIDE_RECORDED_TIME_STATUSES.has(status)) return "-";
  return formatPrayerTime(timestamp ?? null);
}

export default function PrayerRecap() {
  const dropdownClassName =
    "rounded-md border border-slate-500/70 bg-slate-950/90 py-2 pl-3 pr-8 text-sm font-medium text-slate-50 shadow-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-500/60";
  const dropdownStyle = { backgroundColor: "#020617", color: "#f8fafc", colorScheme: "dark" as const };
  const dropdownOptionStyle = { backgroundColor: "#020617", color: "#f8fafc" };

  const { user } = useAuthStore();
  const { classes } = useClassStore();
  const { students } = useStudentStore();
  const { logs, initPrayerSync } = usePrayerStore();
  const { teachers, subscribeToTeachers } = useTeacherStore();
  const { prayerSchedules, holidays, initPrayerScheduleSync, initHolidaySync } = useAttendanceStore();

  const [viewMode, setViewMode] = useState<"summary" | "daily">("summary");
  const [selectedClassName, setSelectedClassName] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    const unsub = initPrayerSync(user?.schoolId);
    return () => unsub();
  }, [initPrayerSync, user?.schoolId]);

  useEffect(() => {
    const unsubPrayerSchedule = initPrayerScheduleSync();
    const unsubHoliday = initHolidaySync();
    return () => {
      unsubPrayerSchedule();
      unsubHoliday();
    };
  }, [initHolidaySync, initPrayerScheduleSync]);

  useEffect(() => {
    const unsub = subscribeToTeachers();
    return () => unsub();
  }, [subscribeToTeachers]);

  const scopedStudents = useMemo(() => {
    const schoolId = normalize(user?.schoolId);
    let result = students || [];
    if (schoolId) {
      result = result.filter((student) => normalize((student as any)?.schoolId) === schoolId);
    }
    result = result.filter((student) => !isNonMuslimStudent(student));
    return result;
  }, [students, user?.schoolId]);

  const teacherClassName = useMemo(() => {
    if (user?.role !== "teacher") return "";
    const me = teachers.find((teacher) => teacher.nuptk === user.id || teacher.id === user.id);
    return me?.homeroomClass ? normalizeClass(me.homeroomClass) : "";
  }, [teachers, user?.id, user?.role]);

  const studentClassName = useMemo(() => {
    if (user?.role !== "student") return "";
    const me = scopedStudents.find((student) => matchesStudentSession(student, user));
    return me?.class ? normalizeClass(me.class) : "";
  }, [scopedStudents, user, user?.role]);

  const forcedClassName = teacherClassName || studentClassName;

  useEffect(() => {
    if (forcedClassName) setSelectedClassName(forcedClassName);
  }, [forcedClassName]);

  const classOptions = useMemo(() => {
    const uniqueNames = Array.from(
      new Set((classes || []).map((item) => normalizeClass(item.name)).filter(Boolean))
    );
    uniqueNames.sort(compareClassNames);
    return uniqueNames;
  }, [classes]);

  const filteredStudents = useMemo(() => {
    let result = scopedStudents;

    if (selectedClassName) {
      const className = normalizeClass(selectedClassName);
      result = result.filter((student) => normalizeClass(student.class) === className);
    }

    if (user?.role === "student") {
      result = result.filter((student) => matchesStudentSession(student, user));
    }

    return result;
  }, [scopedStudents, selectedClassName, user, user?.role]);

  const validDates = useMemo(() => {
    return getValidDatesInMonth({
      year: selectedYear,
      month: selectedMonth,
      schedules: prayerSchedules,
      holidays,
    });
  }, [holidays, prayerSchedules, selectedMonth, selectedYear]);

  const validDateSet = useMemo(() => {
    return new Set(validDates.map((date) => toDateKey(date)));
  }, [validDates]);

  const filteredLogMap = useMemo(() => {
    const schoolId = normalize(user?.schoolId);
    const studentKeyToCanonicalId = new Map<string, string>();
    const canonicalStudentMap = new Map<string, Student>();
    const grouped = new Map<string, any>();

    for (const student of filteredStudents) {
      const canonicalId = String(student.id || "").trim();
      const nisnKey = String(student.nisn || "").trim();
      if (!canonicalId) continue;
      canonicalStudentMap.set(canonicalId, student);
      studentKeyToCanonicalId.set(canonicalId, canonicalId);
      if (nisnKey) studentKeyToCanonicalId.set(nisnKey, canonicalId);
    }

    for (const log of logs || []) {
      const logDate = new Date(log.date);
      const logSchoolId = normalize((log as any)?.schoolId);
      const rawStudentId = String(log.studentId || "").trim();
      const canonicalId = studentKeyToCanonicalId.get(rawStudentId);
      const matchesSchool = user?.role === "super_admin" || !schoolId || !logSchoolId || logSchoolId === schoolId;
      if (!matchesSchool || !canonicalId) continue;
      if (logDate.getMonth() + 1 !== selectedMonth || logDate.getFullYear() !== selectedYear) continue;

      const dateKey = toDateKey(logDate);
      if (!validDateSet.has(dateKey)) continue;

      const student = canonicalStudentMap.get(canonicalId);
      const normalizedLog = {
        ...log,
        studentId: canonicalId,
        studentName: student?.name || log.studentName || "Tidak Dikenal",
        studentClass: student?.class || "-",
        studentNisn: student?.nisn || "-",
        recordedTime: log.createdAt || log.updatedAt || log.date,
      };

      grouped.set(
        createStudentDateKey(canonicalId, dateKey),
        pickNewestLog(grouped.get(createStudentDateKey(canonicalId, dateKey)), normalizedLog)
      );
    }

    return grouped;
  }, [filteredStudents, logs, selectedMonth, selectedYear, user?.role, user?.schoolId, validDateSet]);

  const recapRows = useMemo(() => {
    const rows: Array<{
      id: string;
      rowKey: string;
      date: number;
      dateKey: string;
      recordedTime: number | null;
      recordedBy: string;
      studentId: string;
      studentName: string;
      studentClass: string;
      studentNisn: string;
      status: string;
      notes: string;
      isSystemGenerated: boolean;
    }> = [];

    const sortedStudents = [...filteredStudents].sort((a, b) => {
      const classCompare = normalizeClass(a.class).localeCompare(normalizeClass(b.class), "id-ID");
      if (classCompare !== 0) return classCompare;
      return String(a.name || "").localeCompare(String(b.name || ""), "id-ID");
    });

    const sortedDates = [...validDates].sort((a, b) => b.getTime() - a.getTime());

    for (const date of sortedDates) {
      const dateKey = toDateKey(date);

      for (const student of sortedStudents) {
        const canonicalId = String(student.id || "").trim();
        if (!canonicalId) continue;

        const existingLog = filteredLogMap.get(createStudentDateKey(canonicalId, dateKey));

        if (existingLog) {
          rows.push({
            id: String(existingLog.id || `${canonicalId}-${dateKey}`),
            rowKey: `${canonicalId}-${dateKey}`,
            date: Number(existingLog.date || date.getTime()),
            dateKey,
            recordedTime: Number(existingLog.recordedTime || 0) || null,
            recordedBy: String(existingLog.recordedBy || ""),
            studentId: canonicalId,
            studentName: existingLog.studentName || student.name || "Tidak Dikenal",
            studentClass: existingLog.studentClass || student.class || "-",
            studentNisn: existingLog.studentNisn || student.nisn || "-",
            status: String(existingLog.status || "NOT_PRAY"),
            notes: String(existingLog.notes || ""),
            isSystemGenerated: false,
          });
          continue;
        }

        rows.push({
          id: `missing-${canonicalId}-${dateKey}`,
          rowKey: `${canonicalId}-${dateKey}`,
          date: date.getTime(),
          dateKey,
          recordedTime: null,
          recordedBy: "",
          studentId: canonicalId,
          studentName: student.name || "Tidak Dikenal",
          studentClass: student.class || "-",
          studentNisn: student.nisn || "-",
          status: "NOT_PRAY",
          notes: "Otomatis dari hari sholat aktif tanpa log presensi.",
          isSystemGenerated: true,
        });
      }
    }

    return rows;
  }, [filteredLogMap, filteredStudents, validDates]);

  const monthlySummaryRows = useMemo(() => {
    return filteredStudents
      .map((student) => {
        const canonicalId = String(student.id || "").trim();
        let pray = 0;
        let permit = 0;
        let halangan = 0;
        let notPray = 0;
        let effectiveDays = 0;

        if (!canonicalId) {
          return {
            student,
            pray,
            permit,
            halangan,
            notPray,
            percentage: "0",
          };
        }

        for (const date of validDates) {
          const dateKey = toDateKey(date);
          const log = filteredLogMap.get(createStudentDateKey(canonicalId, dateKey));

          if (log?.status === "HALANGAN") {
            halangan += 1;
            continue;
          }

          effectiveDays += 1;

          if (!log || log.status === "NOT_PRAY") {
            notPray += 1;
            continue;
          }

          if (log.status === "PRAY") {
            pray += 1;
            continue;
          }

          if (log.status === "PERMIT") {
            permit += 1;
            continue;
          }

          notPray += 1;
        }

        return {
          student,
          pray,
          permit,
          halangan,
          notPray,
          percentage: effectiveDays > 0 ? String(Math.round((pray / effectiveDays) * 100)) : "0",
        };
      })
      .sort((a, b) => String(a.student.name || "").localeCompare(String(b.student.name || ""), "id-ID"));
  }, [filteredLogMap, filteredStudents, validDates]);

  const selectedClassLabel = selectedClassName || forcedClassName || "-";
  const isClassLocked = Boolean(forcedClassName);
  const canPrint = Boolean(selectedClassLabel && selectedClassLabel !== "-") && filteredStudents.length > 0;

  const handlePrint = () => {
    if (!canPrint) return;
    window.print();
  };

  return (
    <div className="rounded-lg glass-effect-dark-card p-6 shadow">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
            background: white;
            z-index: 9999;
          }
          .no-print {
            display: none !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            font-size: 12px;
          }
          th, td {
            border: 1px solid black !important;
            padding: 4px 8px !important;
            color: black !important;
          }
          ::-webkit-scrollbar {
            display: none;
          }
        }
      `}</style>

      <div className="mb-6 flex flex-col gap-4 no-print">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-medium leading-6 text-slate-100">Data Rekapitulasi</h3>
            <p className="mt-1 text-sm text-slate-400">
              Laporan presensi sholat siswa per kelas
            </p>
          </div>

          <button
            onClick={handlePrint}
            disabled={!canPrint}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-sm font-medium text-white hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Cetak Laporan
          </button>
        </div>

        <div className="flex w-fit space-x-1 rounded-lg bg-slate-800/30 p-1">
          <button
            onClick={() => setViewMode("summary")}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === "summary"
                ? "bg-slate-800/80 text-blue-300 shadow"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            <List className="h-4 w-4" />
            Rekap Bulanan (Siswa)
          </button>
          <button
            onClick={() => setViewMode("daily")}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === "daily"
                ? "bg-slate-800/80 text-blue-300 shadow"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            <Calendar className="h-4 w-4" />
            Riwayat Harian
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-800/30 p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400">Kelas</label>
            <select
              value={selectedClassName}
              onChange={(e) => setSelectedClassName(e.target.value)}
              disabled={isClassLocked}
              className={`${dropdownClassName} min-w-[150px] ${
                isClassLocked ? "cursor-not-allowed text-slate-400 opacity-50" : ""
              }`}
              style={dropdownStyle}
            >
              {!isClassLocked && (
                <option value="" style={dropdownOptionStyle}>
                  -- Pilih Kelas --
                </option>
              )}
              {classOptions.length > 0 ? (
                classOptions.map((name) => (
                  <option key={name} value={name} style={dropdownOptionStyle}>
                    {name}
                  </option>
                ))
              ) : (
                <option disabled style={dropdownOptionStyle}>
                  Data kelas tidak ditemukan
                </option>
              )}
            </select>
            {isClassLocked && (
              <span className="text-[10px] italic text-blue-400">Mode kelas terkunci</span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400">Bulan</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number.parseInt(e.target.value, 10))}
              className={dropdownClassName}
              style={dropdownStyle}
            >
              {MONTHS.map((month, index) => (
                <option key={month} value={index + 1} style={dropdownOptionStyle}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400">Tahun</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number.parseInt(e.target.value, 10))}
              className={dropdownClassName}
              style={dropdownStyle}
            >
              {Array.from({ length: (new Date().getFullYear() + 5) - 2024 + 1 }, (_, index) => 2024 + index).map((year) => (
                <option key={year} value={year} style={dropdownOptionStyle}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div id="print-area">
        <div className="mb-6 hidden text-center print:block">
          <h1 className="text-2xl font-bold uppercase text-black">SMP NEGERI 3 PACET</h1>
          <h2 className="text-xl font-semibold text-black">
            {viewMode === "summary" ? "Laporan Rekapitulasi Sholat" : "Laporan Riwayat Presensi Sholat"}
          </h2>
          <div className="mt-2 flex justify-center gap-8 font-medium text-black">
            <p>Kelas: {selectedClassLabel}</p>
            <p>Periode: {MONTHS[selectedMonth - 1]} {selectedYear}</p>
          </div>
          <div className="mt-4 border-b-2 border-black"></div>
        </div>

        {viewMode === "summary" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700 border border-slate-700">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="w-10 border-b border-slate-700 px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-400">No</th>
                  <th className="border-b border-slate-700 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">NISN</th>
                  <th className="border-b border-slate-700 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Nama Siswa</th>
                  <th className="w-10 border-b border-slate-700 px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-400">L/P</th>
                  <th className="border-b border-slate-700 bg-green-900/20 px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Sh</th>
                  <th className="border-b border-slate-700 bg-blue-900/20 px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-400">I</th>
                  <th className="border-b border-slate-700 bg-purple-900/20 px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Hal</th>
                  <th className="border-b border-slate-700 bg-red-900/20 px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-400">TS</th>
                  <th className="border-b border-slate-700 px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-400">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 bg-slate-900/20">
                {monthlySummaryRows.length > 0 ? (
                  monthlySummaryRows.map((item, index) => (
                    <tr key={String(item.student.id || `${item.student.nisn}-${index}`)} className="hover:bg-slate-800/30">
                      <td className="px-6 py-4 text-center text-sm text-slate-400">{index + 1}</td>
                      <td className="px-6 py-4 text-sm text-slate-400">{item.student.nisn || "-"}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-100">{item.student.name || "-"}</td>
                      <td className="px-6 py-4 text-center text-sm text-slate-400">{(item.student as any).gender || "-"}</td>
                      <td className="bg-green-900/10 px-6 py-4 text-center text-sm font-bold text-green-400">{item.pray}</td>
                      <td className="bg-blue-900/10 px-6 py-4 text-center text-sm font-bold text-blue-400">{item.permit}</td>
                      <td className="bg-purple-900/10 px-6 py-4 text-center text-sm font-bold text-purple-400">{item.halangan}</td>
                      <td className="bg-red-900/10 px-6 py-4 text-center text-sm font-bold text-red-400">{item.notPray}</td>
                      <td className="px-6 py-4 text-center text-sm font-bold text-slate-200">{item.percentage}%</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-sm text-slate-500">
                      {!selectedClassName && !isClassLocked
                        ? "Silakan pilih kelas terlebih dahulu."
                        : "Tidak ada data siswa dalam kelas ini."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700 border border-slate-700">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="border-b border-slate-700 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Tanggal</th>
                  <th className="border-b border-slate-700 px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Jam Presensi</th>
                  <th className="border-b border-slate-700 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Dicatat Oleh</th>
                  <th className="border-b border-slate-700 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Nama Siswa</th>
                  <th className="border-b border-slate-700 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">NISN</th>
                  <th className="border-b border-slate-700 px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Kelas</th>
                  <th className="border-b border-slate-700 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="border-b border-slate-700 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 bg-slate-900/20">
                {recapRows.length > 0 ? (
                  recapRows.map((log) => (
                    <tr key={log.rowKey} className="hover:bg-slate-800/30">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-400">
                        {new Date(log.date).toLocaleDateString("id-ID")}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center font-mono text-sm text-slate-100">
                        {getDisplayPrayerTime(log.status, log.recordedTime)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-400">
                        {log.recordedBy || "-"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-100">
                        {log.studentName}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-400">
                        {log.studentNisn}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center text-sm text-slate-400">
                        {log.studentClass}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={`inline-flex rounded-full px-2 text-xs font-bold leading-5 ${STATUS_BADGE_CLASSES[log.status] || STATUS_BADGE_CLASSES.NOT_PRAY}`}>
                          {STATUS_LABELS[log.status] || log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {log.notes || (log.isSystemGenerated ? "Otomatis dari hari sholat aktif tanpa log presensi." : "-")}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-500">
                      {!selectedClassName && !isClassLocked
                        ? "Silakan pilih kelas terlebih dahulu."
                        : "Tidak ada data presensi sholat yang ditemukan."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
