import { useState, useMemo, useEffect } from "react";
import { useAttendanceStore } from "@/store/useAttendanceStore";
import { useStudentStore } from "@/store/useStudentStore";
import { useClassStore } from "@/store/useClassStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useTeacherStore } from "@/store/useTeacherStore";
import { exportToExcel } from "@/utils/export";
import { Search, Download } from "lucide-react";
import { createStudentDateKey, getValidDatesInMonth, pickNewestLog, toDateKey } from "@/utils/presensiRules";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

// Helper to format time (handles both HH:mm strings and timestamps)
const formatTime = (time: string | number | null) => {
  if (!time) return "-";
  
  // Check if it's a timestamp (large number)
  const numTime = Number(time);
  if (!isNaN(numTime) && numTime > 1000000000000) {
    return new Date(numTime).toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    }).replace(".", ":");
  }
  
  return String(time);
};

const STATUS_LABELS: Record<string, string> = {
  PRESENT: "Hadir",
  LATE: "Terlambat",
  SICK: "Sakit",
  PERMIT: "Izin",
  ABSENT: "Tidak Hadir",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  PRESENT: "bg-green-900/30 text-green-400 border border-green-700/30",
  LATE: "bg-yellow-900/30 text-yellow-400 border border-yellow-700/30",
  SICK: "bg-blue-900/30 text-blue-400 border border-blue-700/30",
  PERMIT: "bg-purple-900/30 text-purple-400 border border-purple-700/30",
  ABSENT: "bg-red-900/30 text-red-400 border border-red-700/30",
};

const HIDE_TIME_STATUSES = new Set(["ABSENT", "SICK", "PERMIT"]);

function getDisplayTime(status: string | undefined, time: string | number | null | undefined) {
  if (!status || HIDE_TIME_STATUSES.has(status)) return "-";
  return formatTime(time ?? null);
}

export default function AttendanceRecap() {
  const dropdownClassName =
    "px-3 py-2 rounded-md border border-slate-500/70 bg-slate-950/90 text-sm font-medium text-slate-50 shadow-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-500/60";
  const dropdownStyle = { backgroundColor: "#020617", color: "#f8fafc", colorScheme: "dark" as const };
  const dropdownOptionStyle = { backgroundColor: "#020617", color: "#f8fafc" };
  const { logs, schedules, holidays, initAttendanceSync, initScheduleSync, initHolidaySync } = useAttendanceStore();
  const { students } = useStudentStore();
  const { classes } = useClassStore();
  const { user } = useAuthStore();
  const { teachers, subscribeToTeachers } = useTeacherStore();

  const normalize = (value: unknown) => String(value || "").trim().toLowerCase();
  const normalizeClass = (value: unknown) => String(value || "").trim().toUpperCase();

  const compareClassNames = (a: string, b: string) => {
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
      const m = raw.match(/^(VIII|VII|IX)\s*[- ]?\s*(.*)$/);
      if (m) return String(m[2] || "").trim();
      const compact = raw.replace(/\s+/g, "").replace(/-/g, "");
      const m2 = compact.match(/^(7|8|9)(.*)$/);
      if (m2) return String(m2[2] || "").trim();
      return raw;
    };

    const ga = gradeFrom(a);
    const gb = gradeFrom(b);
    if (ga !== gb) return ga - gb;
    const sa = suffixFrom(a);
    const sb = suffixFrom(b);
    if (!sa && sb) return -1;
    if (sa && !sb) return 1;
    return sa.localeCompare(sb, "id-ID", { numeric: true, sensitivity: "base" });
  };

  const scopedStudents = useMemo(() => {
    const sid = normalize(user?.schoolId);
    if (!sid) return students || [];
    return (students || []).filter((s) => normalize((s as any)?.schoolId) === sid);
  }, [students, user?.schoolId]);

  useEffect(() => {
    const unsub = subscribeToTeachers();
    return () => unsub();
  }, [subscribeToTeachers]);

  useEffect(() => {
    const unsubAttendance = initAttendanceSync();
    const unsubSchedule = initScheduleSync();
    const unsubHoliday = initHolidaySync();
    return () => {
      unsubAttendance();
      unsubSchedule();
      unsubHoliday();
    };
  }, [initAttendanceSync, initHolidaySync, initScheduleSync]);

  const [selectedClassName, setSelectedClassName] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState("");

  const teacherClassName = useMemo(() => {
    if (user?.role !== "teacher") return "";
    const me = teachers.find((t) => t.nuptk === user.id);
    return me?.homeroomClass ? String(me.homeroomClass).trim().toUpperCase() : "";
  }, [teachers, user?.id, user?.role]);

  useEffect(() => {
    if (teacherClassName) setSelectedClassName(teacherClassName);
  }, [teacherClassName]);

  const classOptions = useMemo(() => {
    const uniq = Array.from(
      new Set((classes || []).map((c) => normalizeClass(c.name)).filter(Boolean))
    );
    uniq.sort(compareClassNames);
    return uniq;
  }, [classes, compareClassNames]);

  // Filter students
  const filteredStudents = useMemo(() => {
    let result = scopedStudents || [];

    if (selectedClassName) {
      const cls = normalizeClass(selectedClassName);
      result = result.filter((s) => normalizeClass((s as any)?.class) === cls);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(query) || 
        s.nisn.includes(query)
      );
    }

    return result;
  }, [normalizeClass, scopedStudents, searchQuery, selectedClassName]);

  const validDates = useMemo(() => {
    return getValidDatesInMonth({
      year: selectedYear,
      month: selectedMonth,
      schedules,
      holidays,
    });
  }, [holidays, schedules, selectedMonth, selectedYear]);

  const validDateSet = useMemo(() => {
    return new Set(validDates.map((date) => toDateKey(date)));
  }, [validDates]);

  const filteredLogMap = useMemo(() => {
    const studentKeyToCanonicalId = new Map<string, string>();
    const canonicalStudentMap = new Map<string, typeof filteredStudents[number]>();
    const grouped = new Map<string, any>();

    for (const student of filteredStudents) {
      const canonicalId = String(student.id || "").trim();
      if (!canonicalId) continue;
      const nisn = String(student.nisn || "").trim();
      canonicalStudentMap.set(canonicalId, student);
      studentKeyToCanonicalId.set(canonicalId, canonicalId);
      if (nisn) studentKeyToCanonicalId.set(nisn, canonicalId);
    }

    for (const log of logs || []) {
      const rawStudentId = String(log.studentId || "").trim();
      const canonicalId = studentKeyToCanonicalId.get(rawStudentId);
      if (!canonicalId) continue;

      const logDate = new Date(log.date);
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
      };

      grouped.set(
        createStudentDateKey(canonicalId, dateKey),
        pickNewestLog(grouped.get(createStudentDateKey(canonicalId, dateKey)), normalizedLog)
      );
    }

    return grouped;
  }, [filteredStudents, logs, selectedMonth, selectedYear, validDateSet]);

  const recapRows = useMemo(() => {
    const rows: Array<{
      id: string;
      rowKey: string;
      date: number;
      dateKey: string;
      checkInTime: string | number | null;
      checkOutTime: string | number | null;
      studentId: string;
      studentName: string;
      studentClass: string;
      studentNisn: string;
      status: string;
      notes: string;
      isSystemGenerated: boolean;
    }> = [];

    const sortedStudents = [...filteredStudents].sort((a, b) => {
      const classCompare = normalizeClass((a as any)?.class).localeCompare(normalizeClass((b as any)?.class), "id-ID");
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
            checkInTime: existingLog.checkInTime ?? null,
            checkOutTime: existingLog.checkOutTime ?? null,
            studentId: canonicalId,
            studentName: existingLog.studentName || student.name || "Tidak Dikenal",
            studentClass: existingLog.studentClass || student.class || "-",
            studentNisn: existingLog.studentNisn || student.nisn || "-",
            status: String(existingLog.status || "ABSENT"),
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
          checkInTime: null,
          checkOutTime: null,
          studentId: canonicalId,
          studentName: student.name || "Tidak Dikenal",
          studentClass: student.class || "-",
          studentNisn: student.nisn || "-",
          status: "ABSENT",
          notes: "Otomatis dari hari sekolah aktif tanpa log presensi.",
          isSystemGenerated: true,
        });
      }
    }

    return rows;
  }, [filteredLogMap, filteredStudents, validDates]);

  // Stats
  const stats = useMemo(() => {
    const totals = {
      present: 0,
      late: 0,
      sick: 0,
      permit: 0,
      absent: 0,
      validDays: validDates.length,
      effectiveObligation: 0,
    };

    for (const student of filteredStudents) {
      const canonicalId = String(student.id || "").trim();
      if (!canonicalId) continue;

      for (const date of validDates) {
        const dateKey = toDateKey(date);
        const log = filteredLogMap.get(createStudentDateKey(canonicalId, dateKey));

        if (!log || log.status === "ABSENT") {
          totals.absent += 1;
          totals.effectiveObligation += 1;
          continue;
        }

        if (log.status === "PRESENT") {
          totals.present += 1;
          totals.effectiveObligation += 1;
          continue;
        }

        if (log.status === "LATE") {
          totals.late += 1;
          totals.effectiveObligation += 1;
          continue;
        }

        if (log.status === "SICK") {
          totals.sick += 1;
          continue;
        }

        if (log.status === "PERMIT") {
          totals.permit += 1;
          continue;
        }

        totals.absent += 1;
        totals.effectiveObligation += 1;
      }
    }
    
    return totals;
  }, [filteredLogMap, filteredStudents, validDates]);

  const handleExport = () => {
    const exportData = recapRows.map((l) => ({
      'Tanggal': new Date(l.date).toLocaleDateString('id-ID'),
      'Jam Datang': getDisplayTime(l.status, l.checkInTime),
      'Jam Pulang': getDisplayTime(l.status, l.checkOutTime),
      'NISN': l.studentNisn,
      'Nama Siswa': l.studentName,
      'Kelas': l.studentClass,
      'Status': STATUS_LABELS[l.status] || l.status,
      'Keterangan': l.notes || '-'
    }));
    
    exportToExcel(exportData, `Rekap_Absensi_${MONTHS[selectedMonth-1]}_${selectedYear}`);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatItem label="Hadir" value={stats.present} color="bg-green-900/30 text-green-400 border border-green-700/30" />
        <StatItem label="Terlambat" value={stats.late} color="bg-yellow-900/30 text-yellow-400 border border-yellow-700/30" />
        <StatItem label="Sakit" value={stats.sick} color="bg-blue-900/30 text-blue-400 border border-blue-700/30" />
        <StatItem label="Izin" value={stats.permit} color="bg-purple-900/30 text-purple-400 border border-purple-700/30" />
        <StatItem label="Tidak Hadir" value={stats.absent} color="bg-red-900/30 text-red-400 border border-red-700/30" />
        <StatItem label="Hari Sekolah Aktif" value={stats.validDays} color="bg-slate-800/30 text-slate-200 border border-slate-700/30" />
      </div>

      {/* Filters & Export */}
      <div className="glass-effect-dark-card p-4 rounded-lg shadow-sm space-y-4 md:space-y-0 md:flex md:items-center md:justify-between gap-4">
        <div className="flex flex-col md:flex-row gap-4 flex-1">
            <select
                value={selectedClassName}
                onChange={(e) => setSelectedClassName(e.target.value)}
                disabled={Boolean(teacherClassName)}
                className={`${dropdownClassName} ${teacherClassName ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={dropdownStyle}
            >
              {!teacherClassName && <option value="" style={dropdownOptionStyle}>Semua Kelas</option>}
              {classOptions.map((name) => (
                <option key={name} value={name} style={dropdownOptionStyle}>{name}</option>
              ))}
            </select>

            <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className={dropdownClassName}
                style={dropdownStyle}
            >
              {MONTHS.map((month, index) => (
                <option key={index + 1} value={index + 1} style={dropdownOptionStyle}>{month}</option>
              ))}
            </select>
            
             <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className={dropdownClassName}
                style={dropdownStyle}
            >
              {Array.from({ length: 2040 - 2024 + 1 }, (_, i) => 2024 + i).map((year) => (
                <option key={year} value={year} style={dropdownOptionStyle}>
                  {year}
                </option>
              ))}
            </select>

            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                type="text"
                placeholder="Cari siswa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-600 rounded-md text-sm text-slate-100 focus:ring-blue-500 bg-slate-900/50"
                />
            </div>
        </div>

        <button
          onClick={handleExport}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
        >
          <Download className="-ml-1 mr-2 h-5 w-5" />
          Ekspor
        </button>
      </div>

      <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
        Rekap menampilkan seluruh siswa terfilter pada setiap hari sekolah aktif.
        {" "}Untuk filter saat ini: <span className="font-semibold text-slate-100">{filteredStudents.length} siswa</span>
        {" "}x <span className="font-semibold text-slate-100">{validDates.length} hari aktif</span>
        {" "}=
        {" "}<span className="font-semibold text-cyan-300">{recapRows.length} baris rekap</span>.
        {" "}Hari aktif tanpa log otomatis ditampilkan sebagai <span className="font-semibold text-red-300">Tidak Hadir</span>.
      </div>

      {/* Table */}
      <div className="glass-effect-dark-card rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Tanggal</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Jam Datang</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Jam Pulang</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Siswa</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Kelas</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Keterangan</th>
              </tr>
            </thead>
            <tbody className="bg-slate-900/20 divide-y divide-slate-700">
              {recapRows.length > 0 ? (
                recapRows.map((log) => (
                  <tr key={log.rowKey} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                      {new Date(log.date).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100 text-center font-mono">
                      {getDisplayTime(log.status, log.checkInTime)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100 text-center font-mono">
                      {getDisplayTime(log.status, log.checkOutTime)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-100">
                      {log.studentName}
                      <div className="text-xs text-slate-400">{log.studentNisn}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                      {log.studentClass}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-bold rounded-full ${STATUS_BADGE_CLASSES[log.status] || STATUS_BADGE_CLASSES.ABSENT}`}>
                        {STATUS_LABELS[log.status] || log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                      {log.notes || (log.isSystemGenerated ? "Otomatis dari hari sekolah aktif tanpa log presensi." : '-')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-slate-500">
                    Tidak ada data absensi yang ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className={`p-4 rounded-lg ${color}`}>
      <dt className="text-sm font-semibold truncate opacity-80">{label}</dt>
      <dd className="mt-1 text-2xl font-bold">{value}</dd>
    </div>
  );
}
