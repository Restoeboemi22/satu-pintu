"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, CalendarDays, UserCheck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePrayerStore } from "@/store/usePrayerStore";
import { useStudentStore } from "@/store/useStudentStore";
import { useClassStore } from "@/store/useClassStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useAttendanceStore } from "@/store/useAttendanceStore";
import type { Student } from "@/types/student";
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
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const CHART_COLORS = {
  pray: "#34d399",
  notPray: "#f87171",
  permit: "#60a5fa",
  exception: "#c084fc",
};

function isNonMuslimStudent(student: Student) {
  const religion = String((student as any)?.religion || (student as any)?.agama || "").trim().toLowerCase();
  if (!religion) return false;
  if (religion === "non_islam" || religion === "non-islam" || religion === "non muslim" || religion === "nonmuslim") return true;
  if (religion.includes("non") && religion.includes("islam")) return true;
  if (religion.includes("kristen") || religion.includes("katolik") || religion.includes("hindu") || religion.includes("buddha") || religion.includes("konghucu")) return true;
  return false;
}

function isStudentActive(student: Student) {
  const status = String((student as any)?.status || "active").trim().toLowerCase();
  return status !== "inactive" && status !== "graduated" && status !== "transferred";
}

export default function PrayerStatistics() {
  const dropdownClassName =
    "px-3 py-2 rounded-md border border-slate-500/70 bg-slate-950/90 text-sm font-medium text-slate-50 shadow-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-500/60";
  const dropdownStyle = { backgroundColor: "#020617", color: "#f8fafc", colorScheme: "dark" as const };
  const dropdownOptionStyle = { backgroundColor: "#020617", color: "#f8fafc" };

  const { logs, initPrayerSync } = usePrayerStore();
  const {
    prayerSchedules,
    holidays,
    initPrayerScheduleSync,
    initHolidaySync,
  } = useAttendanceStore();
  const { students } = useStudentStore();
  const { classes } = useClassStore();
  const { user } = useAuthStore();

  const [selectedClassName, setSelectedClassName] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    const unsubPrayer = initPrayerSync(user?.schoolId);
    const unsubPrayerSchedule = initPrayerScheduleSync();
    const unsubHoliday = initHolidaySync();
    return () => {
      unsubPrayer();
      unsubPrayerSchedule();
      unsubHoliday();
    };
  }, [initHolidaySync, initPrayerScheduleSync, initPrayerSync, user?.schoolId]);

  const isAllowed = user?.role === "admin";

  const scopedStudents = useMemo(() => {
    const sid = normalizeText(user?.schoolId);
    let result = students || [];
    if (sid) {
      result = result.filter((student) => normalizeText((student as any)?.schoolId) === sid);
    }
    return result.filter((student) => !isNonMuslimStudent(student) && isStudentActive(student));
  }, [students, user?.schoolId]);

  const classOptions = useMemo(() => {
    const sid = normalizeText(user?.schoolId);
    const classSet = new Set<string>();

    for (const item of classes || []) {
      const className = normalizeClassName(item.name);
      if (!className) continue;
      const itemSchoolId = normalizeText((item as any)?.schoolId);
      if (sid && itemSchoolId && itemSchoolId !== sid) continue;
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
    let result = scopedStudents;
    if (selectedClassName) {
      result = result.filter((student) => normalizeClassName(student.class) === normalizeClassName(selectedClassName));
    }
    return result;
  }, [scopedStudents, selectedClassName]);

  const validDates = useMemo(
    () => getValidDatesInMonth({ year: selectedYear, month: selectedMonth, schedules: prayerSchedules, holidays }),
    [holidays, prayerSchedules, selectedMonth, selectedYear]
  );

  const filteredLogs = useMemo(() => {
    const studentKeyToCanonicalId = new Map<string, string>();
    const canonicalStudentMap = new Map<string, Student>();

    for (const student of filteredStudents) {
      const canonicalId = String(student.id || "").trim();
      if (!canonicalId) continue;
      canonicalStudentMap.set(canonicalId, student);
      studentKeyToCanonicalId.set(canonicalId, canonicalId);
      const nisnKey = String(student.nisn || "").trim();
      if (nisnKey) studentKeyToCanonicalId.set(nisnKey, canonicalId);
    }

    const validDateSet = new Set(validDates.map((date) => toDateKey(date)));
    const grouped = new Map<string, any>();

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
        studentClass: student?.class || "-",
        studentName: student?.name || log.studentName || "Tidak Dikenal",
      };

      const key = createStudentDateKey(canonicalId, dateKey);
      grouped.set(key, pickNewestLog(grouped.get(key), normalizedLog));
    }

    return grouped;
  }, [filteredStudents, logs, selectedMonth, selectedYear, validDates]);

  const summary = useMemo(() => {
    const totals = {
      pray: 0,
      notPray: 0,
      permit: 0,
      halangan: 0,
      activeStudents: filteredStudents.length,
      validDays: validDates.length,
      totalValidSlots: 0,
      effectiveObligation: 0,
    };

    const classMap = new Map<string, {
      className: string;
      sholat: number;
      tidakSholat: number;
      izin: number;
    }>();

    for (const student of filteredStudents) {
      const canonicalId = String(student.id || "").trim();
      const className = normalizeClassName(student.class);

      if (className && !classMap.has(className)) {
        classMap.set(className, { className, sholat: 0, tidakSholat: 0, izin: 0 });
      }

      for (const date of validDates) {
        const log = filteredLogs.get(createStudentDateKey(canonicalId, toDateKey(date)));
        totals.totalValidSlots += 1;

        if (log?.status === "HALANGAN") {
          totals.halangan += 1;
          continue;
        }

        totals.effectiveObligation += 1;

        if (!log || log.status === "NOT_PRAY") {
          totals.notPray += 1;
          if (className) classMap.get(className)!.tidakSholat += 1;
          continue;
        }

        if (log.status === "PRAY") {
          totals.pray += 1;
          if (className) classMap.get(className)!.sholat += 1;
          continue;
        }

        if (log.status === "PERMIT") {
          totals.permit += 1;
          if (className) classMap.get(className)!.izin += 1;
          continue;
        }

        totals.notPray += 1;
        if (className) classMap.get(className)!.tidakSholat += 1;
      }
    }

    const prayRate = totals.effectiveObligation > 0
      ? Math.round((totals.pray / totals.effectiveObligation) * 100)
      : 0;
    const notPrayRate = totals.effectiveObligation > 0
      ? Math.round((totals.notPray / totals.effectiveObligation) * 100)
      : 0;

    return {
      totals: {
        ...totals,
        prayRate,
        notPrayRate,
      },
      classChartData: Array.from(classMap.values()).sort((a, b) => compareClassNames(a.className, b.className)),
    };
  }, [filteredLogs, filteredStudents, validDates]);

  const pieData = useMemo(() => ([
    { name: "Sholat", value: summary.totals.pray, color: CHART_COLORS.pray },
    { name: "Tidak Sholat", value: summary.totals.notPray, color: CHART_COLORS.notPray },
    { name: "Izin", value: summary.totals.permit, color: CHART_COLORS.permit },
    { name: "Pengecualian", value: summary.totals.halangan, color: CHART_COLORS.exception },
  ]).filter((item) => item.value > 0), [summary.totals]);

  const insightItems = useMemo(() => {
    const topPrayClass = [...summary.classChartData].sort((a, b) => b.sholat - a.sholat)[0];
    const topNotPrayClass = [...summary.classChartData].sort((a, b) => b.tidakSholat - a.tidakSholat)[0];
    return [
      {
        label: "Persentase Sholat",
        value: `${summary.totals.prayRate}%`,
        description: "Sholat dibanding total wajib sholat setelah pengecualian dikeluarkan.",
      },
      {
        label: "Total Wajib Sholat",
        value: `${summary.totals.effectiveObligation}`,
        description: "Total kewajiban sholat setelah status pengecualian dikeluarkan.",
      },
      {
        label: "Kelas Sholat Tertinggi",
        value: topPrayClass ? `${topPrayClass.className} (${topPrayClass.sholat})` : "-",
        description: "Menggambarkan kelas paling patuh di periode terpilih.",
      },
      {
        label: "Kelas Tidak Sholat Tertinggi",
        value: topNotPrayClass ? `${topNotPrayClass.className} (${topNotPrayClass.tidakSholat})` : "-",
        description: "Termasuk hari sholat aktif tanpa log yang dihitung sebagai tidak sholat.",
      },
    ];
  }, [summary.classChartData, summary.totals.effectiveObligation, summary.totals.prayRate]);

  if (!isAllowed) {
    return (
      <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-6 text-sm text-slate-300">
        Statistik presensi sholat hanya tersedia untuk admin sekolah.
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
        <StatsMiniCard title="Siswa Aktif" value={summary.totals.activeStudents} description="Siswa Muslim aktif dalam filter statistik" icon={UserCheck} accent="cyan" />
        <StatsMiniCard title="Hari Sholat Aktif" value={summary.totals.validDays} description="Hanya hari jadwal aktif, bukan Minggu/libur/nonaktif" icon={CalendarDays} accent="blue" />
        <StatsMiniCard title="Persentase Sholat" value={`${summary.totals.prayRate}%`} description="Sholat dibanding total wajib sholat" icon={Activity} accent="green" />
        <StatsMiniCard title="Pengecualian" value={summary.totals.halangan} description="Status yang tidak menurunkan persentase sholat" icon={AlertCircle} accent="purple" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="glass-effect-dark-card rounded-lg p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-100">Komposisi Status Sholat</h3>
            <p className="mt-1 text-sm text-slate-400">Hari sholat aktif tanpa log ikut dihitung sebagai tidak sholat, kecuali jika berstatus pengecualian.</p>
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
            <LegendPill label="Sholat" value={summary.totals.pray} color={CHART_COLORS.pray} />
            <LegendPill label="Tidak Sholat" value={summary.totals.notPray} color={CHART_COLORS.notPray} />
            <LegendPill label="Izin" value={summary.totals.permit} color={CHART_COLORS.permit} />
            <LegendPill label="Pengecualian" value={summary.totals.halangan} color={CHART_COLORS.exception} />
          </div>
        </div>

        <div className="glass-effect-dark-card rounded-lg p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-100">Perbandingan Antar Kelas</h3>
            <p className="mt-1 text-sm text-slate-400">Fokus pada sholat, tidak sholat, dan izin per kelas dari hari aktif yang valid.</p>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.classChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="className" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                <Tooltip content={<StatisticsTooltip />} cursor={{ fill: "transparent" }} />
                <Bar dataKey="sholat" name="Sholat" fill={CHART_COLORS.pray} radius={[6, 6, 0, 0]} maxBarSize={42} />
                <Bar dataKey="tidakSholat" name="Tidak Sholat" fill={CHART_COLORS.notPray} radius={[6, 6, 0, 0]} maxBarSize={42} />
                <Bar dataKey="izin" name="Izin" fill={CHART_COLORS.permit} radius={[6, 6, 0, 0]} maxBarSize={42} />
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
  accent: "green" | "red" | "purple" | "cyan" | "blue";
}) {
  const accentMap = {
    green: "bg-green-500/10 text-green-300 border-green-500/20",
    red: "bg-red-500/10 text-red-300 border-red-500/20",
    purple: "bg-purple-500/10 text-purple-300 border-purple-500/20",
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
