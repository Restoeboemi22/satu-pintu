"use client";

import { useMemo, useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Award, FileSpreadsheet, Pencil, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { edulockAuth } from "@/lib/edulockFirebase";
import { DisciplineRule, useDisciplineStore } from "@/store/useDisciplineStore";
import { useStudentStore } from "@/store/useStudentStore";
import { useClassStore } from "@/store/useClassStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useTeacherStore } from "@/store/useTeacherStore";
import { exportToExcel } from "@/utils/export";

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const START_YEAR = 2020;
const END_YEAR = 2040;
const RULE_SEVERITY_OPTIONS: DisciplineRule["severity"][] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const normalizeIdentity = (value: unknown) => String(value || "").trim();

const getStudentIdentityCandidates = (student?: { id?: string | number; nisn?: string | number } | null) => {
  if (!student) return [];

  return [
    normalizeIdentity(student.id),
    normalizeIdentity(student.nisn),
  ].filter((value, index, array) => value && array.indexOf(value) === index);
};

const createEmptyRuleForm = () => ({
  ruleName: "",
  points: "5",
  severity: "LOW" as DisciplineRule["severity"],
  description: "",
  isActive: true,
});

const callDisciplineAdminApi = async (
  method: "POST" | "DELETE",
  payload: Record<string, unknown>
) => {
  const currentUser = edulockAuth.currentUser;
  if (!currentUser) {
    throw new Error("Sesi admin tidak aktif. Silakan login ulang.");
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch("/api/admin/discipline", {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.success === false) {
    throw new Error(String(result?.message || "Permintaan backend kedisiplinan gagal diproses."));
  }

  return result;
};

export default function DisciplinePage() {
  const router = useRouter();
  const dropdownClassName =
    "w-full px-4 py-3 rounded-2xl border border-slate-500/70 bg-slate-950/90 text-sm font-medium text-slate-50 shadow-sm outline-none transition-all focus:border-red-400 focus:ring-2 focus:ring-red-500/60";
  const dropdownStyle = { backgroundColor: "#020617", color: "#f8fafc", colorScheme: "dark" as const };
  const dropdownOptionStyle = { backgroundColor: "#020617", color: "#f8fafc" };
  
  const { user } = useAuthStore();
  const { records, rules } = useDisciplineStore();
  const { students } = useStudentStore();
  const { classes } = useClassStore();
  const { teachers, subscribeToTeachers } = useTeacherStore();

  useEffect(() => {
    const unsub = subscribeToTeachers();
    return () => unsub();
  }, [subscribeToTeachers]);

  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [ruleForm, setRuleForm] = useState(createEmptyRuleForm);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [ruleFeedback, setRuleFeedback] = useState<string | null>(null);
  const [ruleError, setRuleError] = useState<string | null>(null);

  const schoolScopeId = String(user?.schoolId || "").trim().toLowerCase();
  const canManageRules = Boolean(schoolScopeId) && (user?.role === "admin" || user?.role === "super_admin");

  const studentByIdentity = useMemo(() => {
    const lookup = new Map<string, typeof students[number]>();
    students.forEach((student) => {
      getStudentIdentityCandidates(student).forEach((candidate) => {
        if (!lookup.has(candidate)) {
          lookup.set(candidate, student);
        }
      });
    });
    return lookup;
  }, [students]);

  const className = useMemo(() => {
    if (user?.role === 'teacher') {
      const me = teachers.find(t => t.nuptk === user.id);
      return me?.homeroomClass || null;
    }
    if (user?.role === 'student') {
        return user.class || null;
    }
    return null;
  }, [user, teachers]);

  const filteredData = useMemo(() => {
    if (user?.role === 'student') {
        return records
            .filter((record) => {
              const recordStudentId = normalizeIdentity(record.studentId);
              return [normalizeIdentity(user.id), normalizeIdentity(user.nisn)]
                .filter(Boolean)
                .includes(recordStudentId);
            })
            .map(record => {
                const rule = rules.find(r => r.id === record.ruleId);
                const reporterLabel = record.reportedByName || record.recordedBy || "-";
                return {
                    ...record,
                    studentName: record.studentNameSnapshot || user.name,
                    ruleName: rule?.ruleName || record.ruleNameSnapshot || "Aturan Tidak Dikenal",
                    category: rule?.category || "VIOLATION",
                    reporterLabel,
                };
            })
            .filter(r => r.category === 'VIOLATION')
            .sort((a, b) => b.date - a.date);
    }

    if (!className) return [];
    
    const classStudents = students.filter(s => (s.class || "").toUpperCase() === className.toUpperCase());
    const classStudentIdentities = new Set(
      classStudents.flatMap((student) => getStudentIdentityCandidates(student))
    );

    const classRecords = records
      .filter((record) => classStudentIdentities.has(normalizeIdentity(record.studentId)))
      .map(record => {
        const student = studentByIdentity.get(normalizeIdentity(record.studentId));
        const rule = rules.find(r => r.id === record.ruleId);
        const reporterLabel = record.reportedByName || record.recordedBy || "-";
        return {
          ...record,
          studentName: student?.name || record.studentNameSnapshot || "Siswa Tidak Dikenal",
          ruleName: rule?.ruleName || record.ruleNameSnapshot || "Aturan Tidak Dikenal",
          category: rule?.category || "VIOLATION",
          reporterLabel,
        };
      })
      .filter(r => r.category === 'VIOLATION')
      .sort((a, b) => b.date - a.date);

    return classRecords;
  }, [records, students, rules, className, user, studentByIdentity]);

  const classOptions = useMemo(() => {
    return classes.map((item) => item.name);
  }, [classes]);

  const studentIdentitySet = useMemo(() => {
    const ids = new Set<string>();
    students.forEach((student) => {
      getStudentIdentityCandidates(student).forEach((candidate) => ids.add(candidate));
    });
    return ids;
  }, [students]);

  const adminRecords = useMemo(() => {
    return records
      .filter((record) => studentIdentitySet.has(normalizeIdentity(record.studentId)))
      .map(record => {
        const student = studentByIdentity.get(normalizeIdentity(record.studentId));
        const rule = rules.find(r => r.id === record.ruleId);
        const reporterLabel = record.reportedByName || record.recordedBy || "-";
        const sourceLabel = record.reportedByRole === "teacher"
          ? "Guru"
          : record.reportedByRole === "osis"
            ? "OSIS"
            : "Petugas";
        return {
          ...record,
          studentName: student?.name || record.studentNameSnapshot || "Tidak Diketahui",
          studentClass: student?.class || record.classNameSnapshot || "-",
          ruleName: rule?.ruleName || record.ruleNameSnapshot || "Aturan Tidak Dikenal",
          category: rule?.category || "VIOLATION",
          reporterLabel,
          sourceLabel,
        };
      })
      .filter(r => r.category === "VIOLATION");
  }, [records, rules, studentIdentitySet, studentByIdentity]);

  const adminFilteredRecords = useMemo(() => {
    let list = adminRecords;
    if (selectedClassFilter) {
      list = list.filter(
        r => (r.studentClass || "").toUpperCase() === selectedClassFilter.toUpperCase()
      );
    }
    list = list.filter(record => {
      const d = new Date(record.date);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      return month === selectedMonth && year === selectedYear;
    });
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(record =>
        record.studentName.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => b.date - a.date);
  }, [adminRecords, selectedClassFilter, selectedMonth, selectedYear, searchQuery]);

  const stats = useMemo(() => {
    const totalCases = filteredData.length;
    const totalPoints = filteredData.reduce((sum, r) => sum + r.points, 0);
    return { totalCases, totalPoints };
  }, [filteredData]);

  const adminStats = useMemo(() => {
    const totalCases = adminFilteredRecords.length;
    const totalPoints = adminFilteredRecords.reduce((sum, r) => sum + r.points, 0);
    const totalStudents = new Set(adminFilteredRecords.map(r => r.studentId)).size;
    return { totalCases, totalPoints, totalStudents };
  }, [adminFilteredRecords]);

  const violationRules = useMemo(() => {
    return rules
      .filter((rule) => rule.category === "VIOLATION")
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        if (a.points !== b.points) return a.points - b.points;
        return a.ruleName.localeCompare(b.ruleName);
      });
  }, [rules]);

  const resetRuleForm = () => {
    setRuleForm(createEmptyRuleForm());
    setEditingRuleId(null);
  };

  const persistSchoolRules = async (nextRules: DisciplineRule[], successMessage: string) => {
    if (!schoolScopeId) {
      setRuleError("School ID tidak ditemukan. Rule sekolah tidak bisa disimpan.");
      return;
    }

    const payload = nextRules.reduce<Record<string, DisciplineRule>>((acc, rule) => {
      acc[String(rule.id)] = rule;
      return acc;
    }, {});

    setIsSavingRule(true);
    setRuleError(null);
    setRuleFeedback(null);
    try {
      await callDisciplineAdminApi("POST", {
        action: "save-rules",
        schoolId: schoolScopeId,
        rules: Object.values(payload),
      });
      setRuleFeedback(successMessage);
      resetRuleForm();
    } catch (error) {
      console.error("Failed to save school discipline rules", error);
      setRuleError("Gagal menyimpan aturan pelanggaran sekolah.");
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleRuleSubmit = async () => {
    const ruleName = ruleForm.ruleName.trim();
    const points = Number(ruleForm.points);
    if (!ruleName) {
      setRuleError("Nama pelanggaran wajib diisi.");
      return;
    }
    if (!Number.isFinite(points) || points < 0) {
      setRuleError("Poin pelanggaran harus berupa angka 0 atau lebih.");
      return;
    }

    const now = Date.now();
    const existingRule = editingRuleId ? rules.find((rule) => rule.id === editingRuleId) : undefined;
    const nextId = existingRule?.id ?? (rules.reduce((maxId, rule) => Math.max(maxId, rule.id), 0) + 1);
    const nextRule: DisciplineRule = {
      id: nextId,
      ruleName,
      category: "VIOLATION",
      points,
      severity: ruleForm.severity,
      description: ruleForm.description.trim() || null,
      isActive: ruleForm.isActive,
      createdAt: existingRule?.createdAt ?? now,
      updatedAt: now,
    };

    const nextRules = existingRule
      ? rules.map((rule) => (rule.id === nextRule.id ? nextRule : rule))
      : [...rules, nextRule];
    await persistSchoolRules(nextRules, existingRule ? "Aturan pelanggaran berhasil diperbarui." : "Aturan pelanggaran baru berhasil ditambahkan.");
  };

  const startEditRule = (rule: DisciplineRule) => {
    setEditingRuleId(rule.id);
    setRuleFeedback(null);
    setRuleError(null);
    setRuleForm({
      ruleName: rule.ruleName,
      points: String(rule.points),
      severity: rule.severity,
      description: rule.description || "",
      isActive: rule.isActive,
    });
  };

  const toggleRuleActive = async (rule: DisciplineRule) => {
    const nextRules = rules.map((item) =>
      item.id === rule.id
        ? {
            ...item,
            isActive: !item.isActive,
            updatedAt: Date.now(),
          }
        : item
    );
    await persistSchoolRules(
      nextRules,
      `${rule.ruleName} ${rule.isActive ? "dinonaktifkan" : "diaktifkan"} untuk sekolah ini.`
    );
  };

  const deleteRule = async (ruleId: number) => {
    const nextRules = rules.filter((rule) => rule.id !== ruleId);
    if (nextRules.length === 0) {
      setRuleError("Minimal harus ada satu aturan tersimpan.");
      return;
    }
    await persistSchoolRules(nextRules, "Aturan pelanggaran berhasil dihapus dari sekolah ini.");
  };

  const resetSchoolRules = async () => {
    if (!schoolScopeId) {
      setRuleError("School ID tidak ditemukan. Reset default tidak bisa dijalankan.");
      return;
    }
    setIsSavingRule(true);
    setRuleError(null);
    setRuleFeedback(null);
    try {
      await callDisciplineAdminApi("DELETE", {
        action: "reset-rules",
        schoolId: schoolScopeId,
      });
      setRuleFeedback("Aturan sekolah dikembalikan ke default sistem.");
      resetRuleForm();
    } catch (error) {
      console.error("Failed to reset school discipline rules", error);
      setRuleError("Gagal mengembalikan aturan sekolah ke default.");
    } finally {
      setIsSavingRule(false);
    }
  };

  if (user?.role === "admin" || user?.role === "super_admin") {
    const monthLabel = MONTHS[selectedMonth - 1] || "";
    return (
      <div className="space-y-6">
        <div className="glass-effect-dark-card rounded-3xl p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 shadow-lg shadow-red-500/30">
              <Award className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-100">Rekap Kedisiplinan</h1>
              <p className="text-slate-400 mt-1">Monitoring poin pelanggaran dan prestasi siswa</p>
            </div>
          </div>
          <button
            onClick={() => {
              const data = adminFilteredRecords.map((record) => ({
                Tanggal: format(record.date, "d MMM yyyy, HH:mm", { locale: id }),
                Siswa: record.studentName,
                Kelas: record.studentClass,
                Pelapor: record.reporterLabel,
                Sumber: record.sourceLabel,
                Kategori: "Pelanggaran",
                Aturan: record.ruleName,
                Poin: record.points,
              }));
              const fileName = `Rekap_Kedisiplinan_${monthLabel}_${selectedYear}`;
              exportToExcel(data, fileName);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-700 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/40 transition-all duration-200 hover:-translate-y-0.5"
          >
            <FileSpreadsheet className="h-5 w-5" />
            Export Excel
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-effect-dark-card rounded-2xl p-6 border border-red-700/30">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">
              Total Pelanggaran ({monthLabel} {selectedYear})
            </p>
            <p className="mt-2 text-3xl font-black text-red-400">
              {adminStats.totalCases} Kasus
            </p>
          </div>
          <div className="glass-effect-dark-card rounded-2xl p-6 border border-red-700/30">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">
              Total Poin
            </p>
            <p className="mt-2 text-3xl font-black text-red-400">
              {adminStats.totalPoints}
            </p>
          </div>
          <div className="glass-effect-dark-card rounded-2xl p-6 border border-red-700/30">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">
              Siswa Terlibat
            </p>
            <p className="mt-2 text-3xl font-black text-red-400">
              {adminStats.totalStudents}
            </p>
          </div>
        </div>

        <div className="glass-effect-dark-card rounded-3xl p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Kelas</p>
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className={dropdownClassName}
                style={dropdownStyle}
              >
                <option value="" style={dropdownOptionStyle}>Semua Kelas</option>
                {classOptions.map((name) => (
                  <option key={name} value={name} style={dropdownOptionStyle}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bulan</p>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className={dropdownClassName}
                style={dropdownStyle}
              >
                {MONTHS.map((label, index) => (
                  <option key={label} value={index + 1} style={dropdownOptionStyle}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tahun</p>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className={dropdownClassName}
                style={dropdownStyle}
              >
                {Array.from({ length: END_YEAR - START_YEAR + 1 }).map((_, idx) => {
                  const year = START_YEAR + idx;
                  return (
                    <option key={year} value={year} style={dropdownOptionStyle}>
                      {year}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pencarian</p>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama siswa..."
                className="w-full px-4 py-3 border border-slate-700 rounded-2xl text-sm font-medium text-slate-200 bg-slate-900/60 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-200">Riwayat Catatan</h2>
            <div className="rounded-3xl border border-slate-700 overflow-hidden">
              <table className="min-w-full divide-y divide-slate-700/30">
                <thead className="bg-gradient-to-r from-slate-900/70 to-slate-900/50">
                  <tr>
                    <th className="px-8 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Tanggal
                    </th>
                    <th className="px-8 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Siswa
                    </th>
                    <th className="px-8 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Pelapor
                    </th>
                    <th className="px-8 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Kategori
                    </th>
                    <th className="px-8 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Aturan/Keterangan
                    </th>
                    <th className="px-8 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Poin
                    </th>
                    <th className="px-8 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-slate-900/30 divide-y divide-slate-700/30">
                  {adminFilteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-8 py-5 whitespace-nowrap text-sm font-medium text-slate-400">
                        {format(record.date, "d MMM yyyy, HH:mm", { locale: id })}
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-sm font-semibold text-slate-100">
                        {record.studentName}
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-300">
                        <div className="font-semibold text-slate-100">{record.reporterLabel}</div>
                        <div className="text-xs text-slate-500">{record.sourceLabel}</div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <span className="text-sm font-bold text-red-400">
                          Pelanggaran
                        </span>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-400">
                        {record.ruleName}
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-center">
                        <span className="text-sm font-black text-red-400 text-lg">
                          {record.points}
                        </span>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-900/30 text-red-400 border border-red-700/30">
                          Terekam
                        </span>
                      </td>
                    </tr>
                  ))}
                  {adminFilteredRecords.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-8 py-16 text-center"
                      >
                        <div className="text-slate-500 font-semibold">Tidak ada data kedisiplinan ditemukan.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="glass-effect-dark-card rounded-3xl p-6 space-y-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-100">Kelola Daftar Pelanggaran</h2>
              <p className="text-sm text-slate-400">
                Admin sekolah bisa mengubah nama pelanggaran dan poin. APK siswa/guru akan mengikuti otomatis.
              </p>
            </div>
            <button
              onClick={resetSchoolRules}
              disabled={!canManageRules || isSavingRule}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Kembalikan Default
            </button>
          </div>

          {!canManageRules && (
            <div className="rounded-2xl border border-amber-700/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
              School ID akun ini belum tersedia, jadi pengelolaan rule per sekolah belum bisa dipakai.
            </div>
          )}

          {(ruleFeedback || ruleError) && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                ruleError
                  ? "border-red-700/40 bg-red-950/30 text-red-200"
                  : "border-emerald-700/40 bg-emerald-950/30 text-emerald-200"
              }`}
            >
              {ruleError || ruleFeedback}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.85fr)]">
            <div className="rounded-3xl border border-slate-700/50 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-700/40 xl:min-w-[760px]">
                <colgroup>
                  <col className="w-[42%]" />
                  <col className="w-[10%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[24%]" />
                </colgroup>
                <thead className="bg-slate-900/80">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Pelanggaran</th>
                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Poin</th>
                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Level</th>
                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                  {violationRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-5 py-4 align-top">
                        <div className="font-semibold text-slate-100">{rule.ruleName}</div>
                        <div className="mt-1 text-xs text-slate-500">{rule.description || "Tanpa deskripsi tambahan."}</div>
                      </td>
                      <td className="px-5 py-4 text-center font-black text-red-400">{rule.points}</td>
                      <td className="px-5 py-4 text-center text-xs font-semibold text-slate-300">{rule.severity}</td>
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                            rule.isActive
                              ? "border-emerald-700/40 bg-emerald-900/30 text-emerald-300"
                              : "border-slate-700/40 bg-slate-800/70 text-slate-400"
                          }`}
                        >
                          {rule.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex flex-wrap items-center justify-end gap-2 min-w-[210px]">
                          <button
                            type="button"
                            onClick={() => startEditRule(rule)}
                            disabled={!canManageRules || isSavingRule}
                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-blue-500/50 hover:text-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleRuleActive(rule)}
                            disabled={!canManageRules || isSavingRule}
                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-amber-500/50 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                            {rule.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRule(rule.id)}
                            disabled={!canManageRules || isSavingRule}
                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-red-500/50 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {violationRules.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                        Belum ada aturan pelanggaran yang tersedia.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="rounded-3xl border border-slate-700/50 bg-slate-950/40 p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-100">
                    {editingRuleId ? "Edit Aturan Pelanggaran" : "Tambah Aturan Pelanggaran"}
                  </h3>
                  <p className="text-sm text-slate-400">
                    Perubahan akan disimpan khusus untuk sekolah ini.
                  </p>
                </div>
                {editingRuleId ? (
                  <button
                    type="button"
                    onClick={resetRuleForm}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500"
                  >
                    Batal Edit
                  </button>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Nama Pelanggaran</label>
                <input
                  type="text"
                  value={ruleForm.ruleName}
                  onChange={(e) => setRuleForm((prev) => ({ ...prev, ruleName: e.target.value }))}
                  placeholder="Contoh: Pulang Awal"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/40"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Poin</label>
                  <input
                    type="number"
                    min={0}
                    value={ruleForm.points}
                    onChange={(e) => setRuleForm((prev) => ({ ...prev, points: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/40"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Tingkat</label>
                  <select
                    value={ruleForm.severity}
                    onChange={(e) =>
                      setRuleForm((prev) => ({
                        ...prev,
                        severity: e.target.value as DisciplineRule["severity"],
                      }))
                    }
                    className={dropdownClassName}
                    style={dropdownStyle}
                  >
                    {RULE_SEVERITY_OPTIONS.map((severity) => (
                      <option key={severity} value={severity} style={dropdownOptionStyle}>
                        {severity}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Deskripsi</label>
                <textarea
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  placeholder="Jelaskan kondisi pelanggaran ini..."
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/40"
                />
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-700/50 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={ruleForm.isActive}
                  onChange={(e) => setRuleForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-red-500"
                />
                Rule aktif dan tampil di APK
              </label>

              <button
                type="button"
                onClick={handleRuleSubmit}
                disabled={!canManageRules || isSavingRule}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editingRuleId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingRuleId ? "Simpan Perubahan Rule" : "Tambah Rule Baru"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-effect-dark-card rounded-3xl p-8">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 transition-all">
            <ArrowLeft className="w-6 h-6 text-slate-300" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-100">
              {user?.role === 'student' ? 'Riwayat Pelanggaran Saya' : 'Monitoring Kedisiplinan'}
            </h1>
            <p className="text-slate-400 mt-1">
              {user?.role === 'student' 
                ? `Kelas ${className || '-'}` 
                : (className ? `Wali Kelas ${className}` : 'Anda belum memiliki kelas ampu')}
            </p>
          </div>
        </div>
      </div>

      {!className && user?.role !== 'student' ? (
        <div className="text-center py-16 glass-effect-dark-card rounded-3xl shadow-xl">
          <div className="text-xl font-bold text-slate-200 mb-2">Belum Ada Kelas</div>
          <div className="text-slate-500">Akun Anda belum diatur sebagai Wali Kelas. Hubungi admin untuk pengaturan kelas.</div>
        </div>
      ) : (
        <>
          <div className="bg-gradient-to-r from-red-900/30 to-rose-900/30 backdrop-blur-xl rounded-3xl p-8 text-center border border-red-700/30 shadow-xl">
            <h2 className="text-4xl font-black text-red-400">{stats.totalCases} Kasus</h2>
            <p className="text-2xl font-black text-red-400 mt-2">{stats.totalPoints} Poin</p>
            <p className="text-xs text-red-500 mt-3 uppercase tracking-widest font-bold">Pelanggaran</p>
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-200 mb-4">Riwayat Terbaru</h3>
            
            <div className="space-y-4">
              {filteredData.map((record) => (
                <div key={record.id} className="glass-effect-dark-card rounded-3xl p-6 flex items-start gap-4 hover:shadow-xl transition-all">
                  <div className="mt-1 w-3 h-3 bg-red-500 rounded-full shrink-0 shadow-lg shadow-red-500/30" />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-base font-bold text-slate-100 truncate pr-4">
                          {record.studentName}
                        </h4>
                        <p className="text-sm font-semibold text-slate-300 mt-1">
                          {record.ruleName}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {record.description || "-"}
                        </p>
                        <p className="text-xs text-slate-400 mt-2">
                          Pelapor: {record.reporterLabel || "-"}
                        </p>
                        <p className="text-xs text-slate-400 mt-2">
                          {format(record.date, "d MMM yyyy, HH:mm", { locale: id })}
                        </p>
                      </div>
                      
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-black text-red-400">
                          {record.points} Poin
                        </p>
                        <p className="text-xs font-bold text-red-500 uppercase mt-1 tracking-wider">
                          Pelanggaran
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredData.length === 0 && (
                <div className="text-center py-16 glass-effect-dark-card rounded-3xl shadow-lg">
                  <div className="text-slate-500 font-semibold">Tidak ada data pelanggaran.</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
