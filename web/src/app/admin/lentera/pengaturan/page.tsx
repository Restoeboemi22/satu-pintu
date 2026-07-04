"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  Library,
  Plus,
  RefreshCw,
  Save,
  School,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/useAuthStore";
import { AcademicYear, LoanSettings, TaskDefaults, useSettingsStore } from "@/store/useSettingsStore";

export default function LenteraSettingsPage() {
  const { user, _hasHydrated } = useAuthStore();
  const {
    schoolIdentity,
    academicYears,
    activeYearId,
    taskDefaults,
    loanSettings,
    loading,
    saving,
    error,
    lastSyncedAt,
    updateSchoolIdentity,
    addAcademicYear,
    updateAcademicYear,
    setActiveYear,
    deleteAcademicYear,
    updateTaskDefaults,
    updateLoanSettings,
    saveSchoolIdentity,
    saveAcademicYears,
    saveTaskDefaults,
    saveLoanSettings,
    getActiveYear,
    subscribeToSchoolSettings,
  } = useSettingsStore();

  const [identityForm, setIdentityForm] = useState(schoolIdentity);
  const [taskForm, setTaskForm] = useState<TaskDefaults>(taskDefaults);
  const [loanForm, setLoanForm] = useState<LoanSettings>(loanSettings);
  const [showYearForm, setShowYearForm] = useState(false);
  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [yearForm, setYearForm] = useState<Partial<AcademicYear>>({
    name: "",
    semester: "Ganjil",
  });

  useEffect(() => {
    setIdentityForm(schoolIdentity);
  }, [schoolIdentity]);

  useEffect(() => {
    setTaskForm(taskDefaults);
  }, [taskDefaults]);

  useEffect(() => {
    setLoanForm(loanSettings);
  }, [loanSettings]);

  useEffect(() => {
    if (!_hasHydrated) return;
    const sid = String(user?.schoolId || "").trim();
    if (!sid) return;
    const unsubscribe = subscribeToSchoolSettings(sid, user?.schoolName);
    return () => {
      try {
        unsubscribe();
      } catch {}
    };
  }, [_hasHydrated, subscribeToSchoolSettings, user?.schoolId, user?.schoolName]);

  const activeYear = getActiveYear();
  const schoolId = useMemo(() => String(user?.schoolId || "").trim(), [user?.schoolId]);
  const sortedAcademicYears = useMemo(
    () => [...academicYears].sort((a, b) => String(b.name).localeCompare(String(a.name), "id-ID")),
    [academicYears],
  );

  const handleSaveIdentity = async () => {
    try {
      if (!schoolId) {
        toast.error("schoolId admin belum tersedia");
        return;
      }
      updateSchoolIdentity(identityForm);
      await saveSchoolIdentity(schoolId);
      toast.success("Identitas Lentera berhasil disimpan ke Firebase");
    } catch {
      toast.error("Gagal menyimpan identitas Lentera");
    }
  };

  const handleSaveTasks = async () => {
    try {
      if (!schoolId) {
        toast.error("schoolId admin belum tersedia");
        return;
      }
      updateTaskDefaults(taskForm);
      await saveTaskDefaults(schoolId);
      toast.success("Pengaturan tugas berhasil disimpan ke Firebase");
    } catch {
      toast.error("Gagal menyimpan pengaturan tugas");
    }
  };

  const handleSaveLoans = async () => {
    try {
      if (!schoolId) {
        toast.error("schoolId admin belum tersedia");
        return;
      }
      updateLoanSettings(loanForm);
      await saveLoanSettings(schoolId);
      toast.success("Pengaturan peminjaman berhasil disimpan ke Firebase");
    } catch {
      toast.error("Gagal menyimpan pengaturan peminjaman");
    }
  };

  const handleSyncInfo = () => {
    toast.success("Pengaturan sinkronisasi mengikuti DATABASE secara realtime");
  };

  const resetYearForm = () => {
    setYearForm({
      name: "",
      semester: "Ganjil",
    });
    setEditingYearId(null);
    setShowYearForm(false);
  };

  const handleSubmitYear = async () => {
    try {
      if (!schoolId) {
        toast.error("schoolId admin belum tersedia");
        return;
      }
      const name = String(yearForm.name || "").trim();
      const semester = yearForm.semester === "Genap" ? "Genap" : "Ganjil";

      if (!name) {
        toast.error("Lengkapi data tahun ajaran terlebih dahulu");
        return;
      }

      const duplicate = academicYears.find(
        (year) =>
          year.id !== editingYearId &&
          String(year.name).trim().toLowerCase() === name.toLowerCase() &&
          year.semester === semester,
      );
      if (duplicate) {
        toast.error("Tahun ajaran dengan semester yang sama sudah ada");
        return;
      }

      if (editingYearId) {
        updateAcademicYear(editingYearId, { name, semester });
        toast.success(`Tahun ajaran ${name} ${semester} berhasil diperbarui`);
      } else {
        const nextId = `year-${Date.now()}`;
        addAcademicYear({
          id: nextId,
          name,
          semester,
          startDate: "",
          endDate: "",
          isActive: false,
        });
        toast.success(`Tahun ajaran ${name} ${semester} berhasil ditambahkan`);
      }

      await saveAcademicYears(schoolId);
      resetYearForm();
    } catch {
      toast.error("Gagal menyimpan tahun ajaran");
    }
  };

  const openEditYear = (year: AcademicYear) => {
    setEditingYearId(year.id);
    setYearForm({
      name: year.name,
      semester: year.semester,
    });
    setShowYearForm(true);
  };

  if (!_hasHydrated) return <div className="min-h-screen bg-slate-950" />;

  return (
    <div className="space-y-6">
      <div className="glass-effect-dark-card rounded-2xl border border-slate-700/60 p-5 shadow-xl backdrop-blur sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 ring-1 ring-blue-400/25">
                <Settings2 className="h-5 w-5 text-blue-200" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-100">Pengaturan Lentera</h1>
                <p className="mt-1 text-sm text-slate-300">
                  Atur identitas, tahun ajaran, tugas, dan peminjaman untuk
                  {user?.schoolName ? ` ${user.schoolName}` : " Lentera Digital"}.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
              Realtime Firebase
            </span>
            {lastSyncedAt ? (
              <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                Tersinkron {new Date(lastSyncedAt).toLocaleString("id-ID")}
              </span>
            ) : null}
            <Link
              href="/admin/lentera"
              className="inline-flex items-center justify-center rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900/60 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali ke Lentera
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="glass-effect-dark-card rounded-2xl border border-slate-700/60 p-5 shadow-xl backdrop-blur sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">Status Pengaturan</div>
              <div className="mt-1 text-xs text-slate-400">
                {loading ? "Memuat pengaturan sekolah dari Firebase..." : `Pengaturan aktif untuk ${user?.schoolName || "sekolah ini"}.`}
              </div>
            </div>
            <div className="text-xs text-slate-400">
              {schoolId ? `schoolId: ${schoolId}` : "schoolId belum tersedia"}
            </div>
          </div>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-100">
                <School className="h-4 w-4 text-blue-300" />
                <h2 className="text-lg font-semibold">Identitas Lentera</h2>
              </div>
              <p className="mt-1 text-sm text-slate-400">
                Data profil yang dipakai di panel Lentera dan export laporan.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-300">Nama Sekolah</label>
              <input
                type="text"
                value={identityForm.name}
                onChange={(e) => setIdentityForm((s) => ({ ...s, name: e.target.value }))}
                className="block w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Email</label>
              <input
                type="email"
                value={identityForm.email}
                onChange={(e) => setIdentityForm((s) => ({ ...s, email: e.target.value }))}
                className="block w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Telepon</label>
              <input
                type="text"
                value={identityForm.phone}
                onChange={(e) => setIdentityForm((s) => ({ ...s, phone: e.target.value }))}
                className="block w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-300">Alamat</label>
              <textarea
                rows={3}
                value={identityForm.address}
                onChange={(e) => setIdentityForm((s) => ({ ...s, address: e.target.value }))}
                className="block w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-300">Website</label>
              <input
                type="text"
                value={identityForm.website}
                onChange={(e) => setIdentityForm((s) => ({ ...s, website: e.target.value }))}
                className="block w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleSaveIdentity}
              disabled={saving || loading}
              className="inline-flex items-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Menyimpan..." : "Simpan Identitas"}
            </button>
          </div>
        </section>

        <section className="glass-effect-dark-card rounded-2xl border border-slate-700/60 p-5 shadow-xl backdrop-blur sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-100">
                <Calendar className="h-4 w-4 text-blue-300" />
                <h2 className="text-lg font-semibold">Tahun Ajaran</h2>
              </div>
              <p className="mt-1 text-sm text-slate-400">
                Pilih periode aktif agar tugas dan laporan punya konteks semester yang jelas.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {activeYear ? (
                <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Aktif: {activeYear.name} {activeYear.semester}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (showYearForm && !editingYearId) {
                    resetYearForm();
                    return;
                  }
                  setEditingYearId(null);
                  setYearForm({
                    name: "",
                    semester: "Ganjil",
                  });
                  setShowYearForm(true);
                }}
                className="inline-flex items-center rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-900/60"
              >
                <Plus className="mr-2 h-4 w-4" />
                Tambah Tahun Ajaran
              </button>
            </div>
          </div>

          {showYearForm ? (
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 text-sm font-semibold text-slate-100">
                {editingYearId ? "Ubah Tahun Ajaran" : "Tahun Ajaran Baru"}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">Tahun Ajaran</label>
                  <input
                    type="text"
                    placeholder="2026/2027"
                    value={yearForm.name || ""}
                    onChange={(e) => setYearForm((s) => ({ ...s, name: e.target.value }))}
                    className="block w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">Semester</label>
                  <select
                    value={yearForm.semester || "Ganjil"}
                    onChange={(e) => setYearForm((s) => ({ ...s, semester: e.target.value as AcademicYear["semester"] }))}
                    className="block w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
                  >
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetYearForm}
                  className="rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900/60"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSubmitYear}
                  disabled={saving || loading}
                  className="inline-flex items-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:from-blue-700 hover:to-indigo-700"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {editingYearId ? "Simpan Perubahan" : "Tambah Tahun Ajaran"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {sortedAcademicYears.map((year: AcademicYear) => {
              const isActive = year.id === activeYearId;
              return (
                <div
                  key={year.id}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                    isActive
                      ? "border-blue-400/30 bg-blue-500/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{year.name}</div>
                    <div className="mt-1 text-xs text-slate-400">{year.semester}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                        Aktif
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              if (!schoolId) return;
                              setActiveYear(year.id);
                              await saveAcademicYears(schoolId);
                              toast.success(`Tahun ajaran aktif diubah ke ${year.name} ${year.semester}`);
                            } catch {
                              toast.error("Gagal mengubah tahun ajaran aktif");
                            }
                          }}
                          className="inline-flex items-center rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                        >
                          <Check className="mr-1 h-3.5 w-3.5" />
                          Aktifkan
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditYear(year)}
                          className="inline-flex items-center rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10"
                        >
                          Ubah
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              if (!schoolId) return;
                              deleteAcademicYear(year.id);
                              await saveAcademicYears(schoolId);
                              toast.success(`Tahun ajaran ${year.name} ${year.semester} dihapus`);
                            } catch {
                              toast.error("Gagal menghapus tahun ajaran");
                            }
                          }}
                          className="inline-flex items-center rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/15"
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Hapus
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="glass-effect-dark-card rounded-2xl border border-slate-700/60 p-5 shadow-xl backdrop-blur sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-100">
                <BookOpen className="h-4 w-4 text-blue-300" />
                <h2 className="text-lg font-semibold">Pengaturan Tugas</h2>
              </div>
              <p className="mt-1 text-sm text-slate-400">
                Atur nilai bawaan tugas dan perilaku publikasi tugas literasi.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Poin Default</label>
              <input
                type="number"
                min={0}
                value={taskForm.defaultPoints}
                onChange={(e) => setTaskForm((s) => ({ ...s, defaultPoints: Number(e.target.value || 0) }))}
                className="block w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Durasi Default (menit)</label>
              <input
                type="number"
                min={1}
                value={taskForm.defaultDurationMinutes}
                onChange={(e) => setTaskForm((s) => ({ ...s, defaultDurationMinutes: Number(e.target.value || 1) }))}
                className="block w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Pengingat Sebelum Deadline (hari)</label>
              <input
                type="number"
                min={0}
                value={taskForm.reminderDays}
                onChange={(e) => setTaskForm((s) => ({ ...s, reminderDays: Number(e.target.value || 0) }))}
                className="block w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-slate-100">Terbitkan Otomatis</div>
                <div className="text-xs text-slate-400">Jika aktif, tugas baru langsung dibagikan ke siswa.</div>
              </div>
              <button
                type="button"
                onClick={() => setTaskForm((s) => ({ ...s, autoPublish: !s.autoPublish }))}
                className={`inline-flex h-7 w-12 items-center rounded-full p-1 transition ${
                  taskForm.autoPublish ? "bg-blue-600" : "bg-slate-700"
                }`}
              >
                <span
                  className={`h-5 w-5 rounded-full bg-white transition ${taskForm.autoPublish ? "translate-x-5" : ""}`}
                />
              </button>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleSaveTasks}
              disabled={saving || loading}
              className="inline-flex items-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Menyimpan..." : "Simpan Pengaturan Tugas"}
            </button>
          </div>
        </section>

        <section className="glass-effect-dark-card rounded-2xl border border-slate-700/60 p-5 shadow-xl backdrop-blur sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-100">
                <Library className="h-4 w-4 text-blue-300" />
                <h2 className="text-lg font-semibold">Pengaturan Peminjaman</h2>
              </div>
              <p className="mt-1 text-sm text-slate-400">
                Atur durasi pinjam, batas buku aktif, dan denda keterlambatan.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Lama Pinjam Default (hari)</label>
              <input
                type="number"
                min={1}
                value={loanForm.defaultLoanDays}
                onChange={(e) => setLoanForm((s) => ({ ...s, defaultLoanDays: Number(e.target.value || 1) }))}
                className="block w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Batas Buku Aktif per Siswa</label>
              <input
                type="number"
                min={1}
                value={loanForm.maxActiveLoans}
                onChange={(e) => setLoanForm((s) => ({ ...s, maxActiveLoans: Number(e.target.value || 1) }))}
                className="block w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Denda per Hari</label>
              <input
                type="number"
                min={0}
                value={loanForm.finePerDay}
                onChange={(e) => setLoanForm((s) => ({ ...s, finePerDay: Number(e.target.value || 0) }))}
                className="block w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-slate-100">Jatuh Tempo di Akhir Pekan</div>
                <div className="text-xs text-slate-400">Jika nonaktif, jatuh tempo otomatis diarahkan ke hari sekolah.</div>
              </div>
              <button
                type="button"
                onClick={() => setLoanForm((s) => ({ ...s, allowWeekendDueDate: !s.allowWeekendDueDate }))}
                className={`inline-flex h-7 w-12 items-center rounded-full p-1 transition ${
                  loanForm.allowWeekendDueDate ? "bg-blue-600" : "bg-slate-700"
                }`}
              >
                <span
                  className={`h-5 w-5 rounded-full bg-white transition ${loanForm.allowWeekendDueDate ? "translate-x-5" : ""}`}
                />
              </button>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleSaveLoans}
              disabled={saving || loading}
              className="inline-flex items-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Menyimpan..." : "Simpan Pengaturan Peminjaman"}
            </button>
          </div>
        </section>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="glass-effect-dark-card rounded-2xl border border-slate-700/60 p-5 shadow-xl backdrop-blur sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Sinkronisasi Data</h2>
            <p className="mt-1 text-sm text-slate-400">
              Kelas dan anggota tetap mengikuti `DATABASE` secara realtime. Bagian ini menjadi titik kontrol sinkronisasi di versi berikutnya.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSyncInfo}
            className="inline-flex items-center justify-center rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-900/60"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Cek Status Sinkronisasi
          </button>
        </div>
      </section>
    </div>
  );
}
