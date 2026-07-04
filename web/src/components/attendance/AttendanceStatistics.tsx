"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, ShieldAlert, UserCheck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAttendanceStore } from "@/store/useAttendanceStore";
import { useStudentStore } from "@/store/useStudentStore";
import { useClassStore } from "@/store/useClassStore";
import { useAuthStore } from "@/store/useAuthStore";
import {
  compareClassNames,
  createStudentDateKey,
  getValidDatesInMonth,
  normalizeClassName,
  normalizeText,
  pickNewestLog,
  toDateKey,
} from "@/utils/presensiRules";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const CHART_COLORS = {
  present: "#34d399",
  late: "#fbbf24",
  sick: "#60a5fa",
  permit: "#c084fc",
  absent: "#f87171",
};

function isStudentActive(student: any) {
  const status = String(student?.status || "active").trim().toLowerCase();
  return status !== "inactive" && status !== "graduated" && status !== "transferred";
}

export default function AttendanceStatistics() {
  const dropdownClassName =
    "px-3 py-2 rounded-md border border-slate-500/70 bg-slate-950/90 text-sm font-medium text-slate-50 shadow-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-500/60";
  const dropdownStyle = { backgroundColor: "#020617", color: "#f8fafc", colorScheme: "dark" as const };
  const dropdownOptionStyle = { backgroundColor: "#020617", color: "#f8fafc" };

  const {
    logs,
    schedules,
    holidays,
    initAttendanceSync,
    initScheduleSync,
    initHolidaySync,
  } = useAttendanceStore();
  const { students } = useStudentStore();
  const { classes } = useClassStore();
  const { user } = useAuthStore();

  const [selectedClassName, setSelectedClassName] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

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

  const isAllowed = user?.role === "admin";

  const scopedStudents = useMemo(() => {
    const schoolId = normalizeText(user?.schoolId);
    let result = (students || []).filter((student) => isStudentActive(student));
    if (schoolId) {
      result = result.filter((student) => normalizeText((student as any)?.schoolId) === schoolId);
    }
    return result;
  }, [students, user?.schoolId]);

  const classOptions = useMemo(() => {
    const schoolId = normalizeText(user?.schoolId);
    const classSet = new Set<string>();

    for (const item of classes || []) {
      const className = normalizeClassName(item.name);
      if (!className) continue;
      const itemSchoolId = normalizeText((item as any)?.schoolId);
      if (schoolId && itemSchoolId && itemSchoolId !== schoolId) continue;
      classSet.add(className);
    }

    if (classSet.size === 0) {
      for (const student of scopedStudents) {
        const className = normalizeClassName(student.class);
        if (className) classSet.add(className);
      }
    }

    return Array.from(classSet).sort(compareClassNames);
  }, [classes, scopedStudents, user?.schoolId]);

  const filteredStudents = useMemo(() => {
    if (!selectedClassName) return scopedStudents;
    return scopedStudents.filter((student) => normalizeClassName(student.class) === normalizeClassName(selectedClassName));
  }, [scopedStudents, selectedClassName]);

  const validDates = useMemo(
    () => getValidDatesInMonth({ year: selectedYear, month: selectedMonth, schedules, holidays }),
    [holidays, schedules, selectedMonth, selectedYear]
  );

  const filteredLogs = useMemo(() => {
    const studentKeyToCanonicalId = new Map<string, string>();
    const canonicalStudentMap = new Map<string, any>();

    for (const student of filteredStudents) {
      const canonicalId = String(student.id || "").trim();
      if (!canonicalId) continue;
      canonicalStudentMap.set(canonicalId, student);
      const nisn = String(student.nisn || "").trim();
      studentKeyToCanonicalId.set(canonicalId, canonicalId);
      if (nisn) studentKeyToCanonicalId.set(nisn, canonicalId);
    }

    const validDateSet = new Set(validDates.map((date) => toDateKey(date)));
    const grouped = new Map<string, any>();

    for (const log of logs || []) {
      const rawStudentId = String(log.studentId || "").trim();
      const canonicalId = studentKeyToCanonicalId.get(rawStudentId);
      if (!canonicalId) continue;

      const date = new Date(log.date);
      if (date.getMonth() + 1 !== selectedMonth || date.getFullYear() !== selectedYear) continue;

      const dateKey = toDateKey(date);
      if (!validDateSet.has(dateKey)) continue;

      const student = canonicalStudentMap.get(canonicalId);
      const normalizedLog = {
        ...log,
        studentId: canonicalId,
        studentName: student?.name || log.studentName || "Tidak Dikenal",
        studentClass: student?.class || "-",
        studentNisn: student?.nisn || "-",
      };

      const key = createStudentDateKey(canonicalId, dateKey);
      grouped.set(key, pickNewestLog(grouped.get(key), normalizedLog));
    }

    return grouped;
  }, [filteredStudents, logs, selectedMonth, selectedYear, validDates]);

  const summary = useMemo(() => {
    const totals = {
      present: 0,
      late: 0,
      sick: 0,
      permit: 0,
      absent: 0,
      totalValidSlots: 0,
      effectiveObligation: 0,
      activeStudents: filteredStudents.length,
      validDays: validDates.length,
    };

    const classMap = new Map<string, {
      className: string;
      hadir: number;
      terlambat: number;
      alpha: number;
    }>();

    for (const student of filteredStudents) {
      const canonicalId = String(student.id || "").trim();
      const className = normalizeClassName(student.class);

      if (className && !classMap.has(className)) {
        classMap.set(className, { className, hadir: 0, terlambat: 0, alpha: 0 });
      }

      for (const date of validDates) {
        const dateKey = toDateKey(date);
        const log = filteredLogs.get(createStudentDateKey(canonicalId, dateKey));
        totals.totalValidSlots += 1;

        if (!log || log.status === "ABSENT") {
          totals.absent += 1;
          totals.effectiveObligation += 1;
          if (className) classMap.get(className)!.alpha += 1;
          continue;
        }

        if (log.status === "PRESENT") {
          totals.present += 1;
          totals.effectiveObligation += 1;
          if (className) classMap.get(className)!.hadir += 1;
          continue;
        }

        if (log.status === "LATE") {
          totals.late += 1;
          totals.effectiveObligation += 1;
          if (className) classMap.get(className)!.terlambat += 1;
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
        if (className) classMap.get(className)!.alpha += 1;
      }
    }

    const attendanceRate = totals.effectiveObligation > 0
      ? Math.round(((totals.present + totals.late) / totals.effectiveObligation) * 100)
      : 0;
    const pureAttendanceRate = totals.effectiveObligation > 0
      ? Math.round((totals.present / totals.effectiveObligation) * 100)
      : 0;
    const violationRate = totals.effectiveObligation > 0
      ? Math.round(((totals.late + totals.absent) / totals.effectiveObligation) * 100)
      : 0;

    return {
      totals: {
        ...totals,
        attendanceRate,
        pureAttendanceRate,
        violationRate,
      },
      classChartData: Array.from(classMap.values()).sort((a, b) => compareClassNames(a.className, b.className)),
    };
  }, [filteredLogs, filteredStudents, validDates]);

  const pieData = useMemo(() => ([
    { name: "Hadir", value: summary.totals.present, color: CHART_COLORS.present },
    { name: "Terlambat", value: summary.totals.late, color: CHART_COLORS.late },
    { name: "Sakit", value: summary.totals.sick, color: CHART_COLORS.sick },
    { name: "Izin", value: summary.totals.permit, color: CHART_COLORS.permit },
    { name: "Tidak Hadir", value: summary.totals.absent, color: CHART_COLORS.absent },
  ]).filter((item) => item.value > 0), [summary.totals]);

  const insightItems = useMemo(() => {
    const topAbsentClass = [...summary.classChartData].sort((a, b) => b.alpha - a.alpha)[0];
    const topLateClass = [...summary.classChartData].sort((a, b) => b.terlambat - a.terlambat)[0];

    return [
      {
        label: "Hadir Tepat Waktu",
        value: `${summary.totals.pureAttendanceRate}%`,
        description: "Hanya menghitung hadir normal dari total wajib hadir.",
      },
      {
        label: "Total Wajib Hadir",
        value: `${summary.totals.effectiveObligation}`,
        description: "Total kewajiban presensi setelah sakit dan izin dikecualikan.",
      },
      {
        label: "Kelas Tidak Hadir Tertinggi",
        value: topAbsentClass ? `${topAbsentClass.className} (${topAbsentClass.alpha})` : "-",
        description: "Termasuk hari sekolah aktif tanpa log yang otomatis dianggap tidak hadir.",
      },
      {
        label: "Kelas Terlambat Tertinggi",
        value: topLateClass ? `${topLateClass.className} (${topLateClass.terlambat})` : "-",
        description: "Terlambat tetap dihitung hadir, tetapi tetap masuk pelanggaran disiplin.",
      },
    ];
  }, [summary.classChartData, summary.totals.effectiveObligation, summary.totals.pureAttendanceRate]);

  if (!isAllowed) {
    return (
      <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-6 text-sm text-slate-300">
        Statistik presensi sekolah hanya tersedia untuk admin sekolah.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-effect-dark-card rounded-lg p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row">
          <select
            value={selectedClassName}
            onChange={(e) => setSelectedClassName(e.target.value)}
            className={dropdownClassName}
            style={dropdownStyle}
          >
            <option value="" style={dropdownOptionStyle}>Semua Kelas</option>
            {classOptions.map((name) => (
              <option key={name} value={name} style={dropdownOptionStyle}>{name}</option>
            ))}
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number.parseInt(e.target.value, 10))}
            className={dropdownClassName}
            style={dropdownStyle}
          >
            {MONTHS.map((month, index) => (
              <option key={month} value={index + 1} style={dropdownOptionStyle}>{month}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number.parseInt(e.target.value, 10))}
            className={dropdownClassName}
            style={dropdownStyle}
          >
            {Array.from({ length: 2040 - 2024 + 1 }, (_, index) => 2024 + index).map((year) => (
              <option key={year} value={year} style={dropdownOptionStyle}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsMiniCard title="Siswa Aktif" value={summary.totals.activeStudents} description="Siswa aktif dalam filter statistik" icon={UserCheck} accent="cyan" />
        <StatsMiniCard title="Hari Sekolah Aktif" value={summary.totals.validDays} description="Minggu, libur, dan hari nonaktif tidak dihitung" icon={CalendarDays} accent="blue" />
        <StatsMiniCard title="Persentase Hadir" value={`${summary.totals.attendanceRate}%`} description="Hadir + terlambat dibanding total wajib hadir" icon={Activity} accent="green" />
        <StatsMiniCard title="Tingkat Pelanggaran" value={`${summary.totals.violationRate}%`} description="Terlambat + tidak hadir dibanding total wajib hadir" icon={ShieldAlert} accent="red" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="glass-effect-dark-card rounded-lg p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-100">Komposisi Status Presensi</h3>
            <p className="mt-1 text-sm text-slate-400">Status dihitung dari hari sekolah aktif, dengan hari tanpa log otomatis menjadi tidak hadir.</p>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={65} outerRadius={110} paddingAngle={4}>
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name} fill={entry.color} stroke={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={<StatisticsTooltip />}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <LegendPill label="Hadir" value={summary.totals.present} color={CHART_COLORS.present} />
            <LegendPill label="Terlambat" value={summary.totals.late} color={CHART_COLORS.late} />
            <LegendPill label="Sakit" value={summary.totals.sick} color={CHART_COLORS.sick} />
            <LegendPill label="Izin" value={summary.totals.permit} color={CHART_COLORS.permit} />
            <LegendPill label="Tidak Hadir" value={summary.totals.absent} color={CHART_COLORS.absent} />
          </div>
        </div>

        <div className="glass-effect-dark-card rounded-lg p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-100">Perbandingan Antar Kelas</h3>
            <p className="mt-1 text-sm text-slate-400">Hadir normal dipisah dari terlambat agar disiplin tetap terbaca.</p>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.classChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="className" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                <Tooltip content={<StatisticsTooltip />} cursor={{ fill: "transparent" }} />
                <Bar dataKey="hadir" name="Hadir" fill={CHART_COLORS.present} radius={[6, 6, 0, 0]} maxBarSize={42} />
                <Bar dataKey="terlambat" name="Terlambat" fill={CHART_COLORS.late} radius={[6, 6, 0, 0]} maxBarSize={42} />
                <Bar dataKey="alpha" name="Tidak Hadir" fill={CHART_COLORS.absent} radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {insightItems.map((item) => (
          <div key={item.label} className="glass-effect-dark-card rounded-lg p-5 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 text-2xl font-bold text-slate-100">{item.value}</div>
            <p className="mt-2 text-sm text-slate-400">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsMiniCard({
  title,
  value,
  description,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: typeof UserCheck;
  accent: "green" | "red" | "cyan" | "blue";
}) {
  const accentMap = {
    green: "bg-green-500/10 text-green-300 border-green-500/20",
    red: "bg-red-500/10 text-red-300 border-red-500/20",
    cyan: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
    blue: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  }[accent];

  return (
    <div className="glass-effect-dark-card rounded-lg p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</div>
          <div className="mt-3 text-3xl font-bold text-slate-100">{value}</div>
          <p className="mt-2 text-sm text-slate-400">{description}</p>
        </div>
        <div className={`rounded-xl border p-3 ${accentMap}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function StatisticsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[140px] rounded-xl border border-slate-600/80 bg-slate-950/95 px-3 py-2.5 shadow-2xl shadow-slate-950/60">
      {label ? <div className="mb-2 text-sm font-semibold text-slate-100">{label}</div> : null}
      <div className="space-y-1.5">
        {payload.map((entry: any) => (
          <div key={`${entry.name}-${entry.value}`} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="font-medium text-slate-200">{entry.name}</span>
            </div>
            <span className="font-bold text-white">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm text-slate-300">{label}</span>
      </div>
      <span className="text-sm font-semibold text-slate-100">{value}</span>
    </div>
  );
}
