"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Info, MapPin, Save } from "lucide-react";
import HolidaySettingsCard from "@/components/attendance/HolidaySettingsCard";
import PrayerRecap from "@/components/attendance/PrayerRecap";
import PrayerStatistics from "@/components/attendance/PrayerStatistics";
import { useAuthStore } from "@/store/useAuthStore";
import { useAttendanceStore } from "@/store/useAttendanceStore";

type ActiveTab = "monitoring" | "statistics" | "settings";
type SaveFeedback = { type: "success" | "error"; message: string } | null;

function timeToMinutes(value: string) {
  const [hours, minutes] = String(value || "").split(":").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60) + minutes;
}

function formatDuration(startTime: string, endTime: string) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null || end <= start) return null;
  const duration = end - start;
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  if (hours > 0 && minutes > 0) return `${hours} jam ${minutes} menit`;
  if (hours > 0) return `${hours} jam`;
  return `${minutes} menit`;
}

export default function PrayerManagementPage() {
  const { user } = useAuthStore();
  const {
    mushollaLocation,
    prayerSchedules,
    updateMushollaLocation,
    updatePrayerSchedule,
    saveMushollaLocationToFirebase,
    savePrayerScheduleToFirebase,
    initMushollaLocationSync,
    initPrayerScheduleSync,
  } = useAttendanceStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>("monitoring");
  const [isSavingMusholla, setIsSavingMusholla] = useState(false);
  const [isSavingPrayerSchedule, setIsSavingPrayerSchedule] = useState(false);
  const [prayerScheduleFeedback, setPrayerScheduleFeedback] = useState<SaveFeedback>(null);
  const canViewStatistics = user?.role === "admin";
  const canManageSettings = user?.role === "admin" || user?.role === "super_admin";

  const subtitle = useMemo(() => {
    if (user?.role === "super_admin") return "Presensi sholat siswa berdasarkan data sekolah yang sedang dipilih.";
    if (user?.role === "admin") return "Presensi sholat siswa berdasarkan master data sekolah Anda.";
    if (user?.role === "teacher") return "Presensi sholat siswa di kelas wali Anda.";
    return "Presensi sholat siswa.";
  }, [user?.role]);

  useEffect(() => {
    const unsub = initMushollaLocationSync();
    return () => unsub();
  }, [initMushollaLocationSync]);

  useEffect(() => {
    const unsub = initPrayerScheduleSync();
    return () => unsub();
  }, [initPrayerScheduleSync]);

  useEffect(() => {
    if (activeTab === "statistics" && !canViewStatistics) {
      setActiveTab("monitoring");
    }
    if (activeTab === "settings" && !canManageSettings) {
      setActiveTab("monitoring");
    }
  }, [activeTab, canManageSettings, canViewStatistics]);

  const safeMusholla = mushollaLocation || { latitude: -7.6698, longitude: 112.5432, radius: 25 };
  const activePrayerSchedules = useMemo(
    () => prayerSchedules.filter((schedule) => schedule.isEnabled),
    [prayerSchedules]
  );
  const invalidPrayerScheduleDays = useMemo(
    () =>
      activePrayerSchedules
        .filter((schedule) => {
          const start = timeToMinutes(schedule.entryTime);
          const end = timeToMinutes(schedule.exitTime);
          return start === null || end === null || end <= start;
        })
        .map((schedule) => schedule.dayName),
    [activePrayerSchedules]
  );
  const prayerScheduleSummary = useMemo(() => {
    if (activePrayerSchedules.length === 0) return null;
    const starts = activePrayerSchedules
      .map((schedule) => timeToMinutes(schedule.entryTime))
      .filter((value): value is number => value !== null);
    const ends = activePrayerSchedules
      .map((schedule) => timeToMinutes(schedule.exitTime))
      .filter((value): value is number => value !== null);

    return {
      activeDays: activePrayerSchedules.length,
      earliestStart: starts.length > 0 ? Math.min(...starts) : null,
      latestEnd: ends.length > 0 ? Math.max(...ends) : null,
    };
  }, [activePrayerSchedules]);
  const hasPrayerScheduleError = invalidPrayerScheduleDays.length > 0;

  const formatMinutesAsTime = (totalMinutes: number | null) => {
    if (totalMinutes === null) return "-";
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  const parseInputNumber = (raw: string): number | null => {
    const normalized = String(raw || "").trim().replace(",", ".");
    if (!normalized) return null;
    const value = Number.parseFloat(normalized);
    if (!Number.isFinite(value)) return null;
    return value;
  };

  const handleMushollaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const parsed = parseInputNumber(value);
    if (parsed === null) return;
    updateMushollaLocation({ [name]: parsed });
  };

  const handleSaveMusholla = async () => {
    setIsSavingMusholla(true);
    try {
      await saveMushollaLocationToFirebase();
      alert("Koordinat musholla berhasil disimpan ke Database!");
    } catch (error) {
      console.error("Failed to save musholla location", error);
      const message = (error as any)?.message ? String((error as any).message) : String(error);
      alert(`Gagal menyimpan koordinat musholla. ${message}`);
    } finally {
      setIsSavingMusholla(false);
    }
  };

  const handlePrayerScheduleToggle = (dayId: number, current: boolean) => {
    setPrayerScheduleFeedback(null);
    updatePrayerSchedule(dayId, { isEnabled: !current });
  };

  const handlePrayerScheduleTimeChange = (dayId: number, field: "entryTime" | "exitTime", value: string) => {
    setPrayerScheduleFeedback(null);
    updatePrayerSchedule(dayId, { [field]: value });
  };

  const handleSavePrayerSchedule = async () => {
    if (activePrayerSchedules.length === 0) {
      setPrayerScheduleFeedback({
        type: "error",
        message: "Minimal satu hari harus diaktifkan untuk jadwal presensi sholat.",
      });
      return;
    }

    if (hasPrayerScheduleError) {
      setPrayerScheduleFeedback({
        type: "error",
        message: `Jam selesai harus lebih besar dari jam mulai. Periksa: ${invalidPrayerScheduleDays.join(", ")}.`,
      });
      return;
    }

    setIsSavingPrayerSchedule(true);
    setPrayerScheduleFeedback(null);
    try {
      await savePrayerScheduleToFirebase();
      setPrayerScheduleFeedback({
        type: "success",
        message: "Jadwal sholat berhasil disimpan dan disinkronkan ke Cloud.",
      });
    } catch (error) {
      console.error("Failed to save prayer schedule", error);
      const message = (error as any)?.message ? String((error as any).message) : "Gagal menyimpan jadwal sholat ke Cloud.";
      setPrayerScheduleFeedback({
        type: "error",
        message,
      });
    } finally {
      setIsSavingPrayerSchedule(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Presensi Sholat</h1>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>

        <div className="mt-6 border-b border-slate-700">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("monitoring")}
              className={`${
                activeTab === "monitoring"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Monitoring & Rekapitulasi
            </button>
            {canViewStatistics && (
              <button
                onClick={() => setActiveTab("statistics")}
                className={`${
                  activeTab === "statistics"
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                Statistik
              </button>
            )}
            {canManageSettings && (
              <button
                onClick={() => setActiveTab("settings")}
                className={`${
                  activeTab === "settings"
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                Pengaturan Sistem
              </button>
            )}
          </nav>
        </div>
      </div>

      <div className="mt-6">
        {activeTab === "monitoring" ? (
          <PrayerRecap />
        ) : activeTab === "statistics" && canViewStatistics ? (
          <PrayerStatistics />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <div className="rounded-lg glass-effect-dark-card p-6 shadow">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-slate-100">Jadwal Sholat</h3>
                    <p className="mt-1 text-sm text-slate-400">Atur hari aktif dan rentang jam presensi sholat.</p>
                  </div>
                  <button
                    onClick={handleSavePrayerSchedule}
                    disabled={isSavingPrayerSchedule || activePrayerSchedules.length === 0}
                    className="inline-flex items-center justify-center rounded-md border border-transparent bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    {isSavingPrayerSchedule ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>

                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">Hari Aktif</div>
                    <div className="mt-1 text-xl font-bold text-white">{activePrayerSchedules.length} hari</div>
                  </div>
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-200">Mulai Paling Awal</div>
                    <div className="mt-1 text-xl font-bold text-white">
                      {formatMinutesAsTime(prayerScheduleSummary?.earliestStart ?? null)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">Selesai Paling Akhir</div>
                    <div className="mt-1 text-xl font-bold text-white">
                      {formatMinutesAsTime(prayerScheduleSummary?.latestEnd ?? null)}
                    </div>
                  </div>
                </div>

                {prayerScheduleFeedback && (
                  <div
                    className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                      prayerScheduleFeedback.type === "success"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                        : "border-red-500/30 bg-red-500/10 text-red-100"
                    }`}
                  >
                    {prayerScheduleFeedback.message}
                  </div>
                )}

                <div className="space-y-3">
                  {prayerSchedules.map((schedule) => {
                    const start = timeToMinutes(schedule.entryTime);
                    const end = timeToMinutes(schedule.exitTime);
                    const hasTimeError = schedule.isEnabled && (start === null || end === null || end <= start);
                    const durationLabel = formatDuration(schedule.entryTime, schedule.exitTime);

                    return (
                      <div
                        key={schedule.dayId}
                        className={`flex flex-col justify-between rounded-lg border p-3 transition-all sm:flex-row sm:items-center ${
                          hasTimeError
                            ? "border-red-500/30 bg-red-500/10"
                            : schedule.isEnabled
                              ? "border-blue-700/30 bg-blue-900/30"
                              : "border-slate-700/30 bg-slate-800/30 opacity-75"
                        }`}
                      >
                        <div className="mb-3 flex min-w-[120px] items-center gap-3 sm:mb-0">
                          <button
                            onClick={() => handlePrayerScheduleToggle(schedule.dayId, schedule.isEnabled)}
                            className={`flex h-6 w-6 items-center justify-center rounded border transition-colors ${
                              schedule.isEnabled
                                ? "border-blue-500 bg-blue-500 text-white"
                                : "border-slate-600 bg-slate-900"
                            }`}
                          >
                            {schedule.isEnabled && <Check className="h-4 w-4" />}
                          </button>
                          <div>
                            <div className={`font-medium ${schedule.isEnabled ? "text-slate-100" : "text-slate-400"}`}>
                              {schedule.dayName}
                            </div>
                            <div className="mt-1">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                                  schedule.isEnabled
                                    ? "bg-emerald-500/10 text-emerald-100 ring-emerald-400/20"
                                    : "bg-slate-700/40 text-slate-300 ring-slate-500/30"
                                }`}
                              >
                                {schedule.isEnabled ? "Aktif" : "Nonaktif"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {schedule.isEnabled && (
                          <div className="flex flex-1 flex-col gap-3 sm:items-end">
                            <div className="flex items-center gap-4 sm:justify-end">
                              <div className="flex items-center gap-2">
                                <Clock className="hidden h-4 w-4 text-slate-400 sm:block" />
                                <div className="flex flex-col">
                                  <label className="text-[10px] font-semibold uppercase text-slate-400">Mulai</label>
                                  <input
                                    type="time"
                                    value={schedule.entryTime}
                                    onChange={(e) => handlePrayerScheduleTimeChange(schedule.dayId, "entryTime", e.target.value)}
                                    className="w-24 rounded-md border border-slate-600 bg-slate-900/50 p-1 text-sm text-slate-100 focus:border-blue-500 focus:ring-blue-500"
                                  />
                                </div>
                              </div>
                              <div className="flex flex-col">
                                <label className="text-[10px] font-semibold uppercase text-slate-400">Selesai</label>
                                <input
                                  type="time"
                                  value={schedule.exitTime}
                                  onChange={(e) => handlePrayerScheduleTimeChange(schedule.dayId, "exitTime", e.target.value)}
                                  className="w-24 rounded-md border border-slate-600 bg-slate-900/50 p-1 text-sm text-slate-100 focus:border-blue-500 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                            <div className={`text-xs ${hasTimeError ? "text-red-200" : "text-slate-400"}`}>
                              {hasTimeError
                                ? "Jam selesai harus lebih besar dari jam mulai."
                                : `Durasi aktif ${durationLabel || "-"}`}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="mt-4 text-xs text-slate-400">
                  Jadwal ini dipakai sebagai acuan hari aktif dan rentang waktu presensi sholat untuk setiap hari sekolah.
                </p>
              </div>

              <div className="rounded-lg glass-effect-dark-card p-6 shadow">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-slate-100">Koordinat Musholla</h3>
                    <p className="mt-1 text-sm text-slate-400">Atur titik presensi khusus untuk ibadah sholat.</p>
                  </div>
                  <MapPin className="h-5 w-5 text-blue-400" />
                </div>

                <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-4">
                  <div className="text-sm font-semibold text-slate-100">Lokasi Musholla (Presensi Sholat)</div>
                  <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-3">
                    <div>
                      <label htmlFor="musholla-latitude" className="block text-sm font-medium text-slate-300">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        name="latitude"
                        id="musholla-latitude"
                        value={safeMusholla.latitude}
                        onChange={handleMushollaChange}
                        className="mt-1 block w-full rounded-md border border-slate-600 bg-slate-900/50 p-2 text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="musholla-longitude" className="block text-sm font-medium text-slate-300">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        name="longitude"
                        id="musholla-longitude"
                        value={safeMusholla.longitude}
                        onChange={handleMushollaChange}
                        className="mt-1 block w-full rounded-md border border-slate-600 bg-slate-900/50 p-2 text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="musholla-radius" className="block text-sm font-medium text-slate-300">Radius (Meter)</label>
                      <input
                        type="number"
                        name="radius"
                        id="musholla-radius"
                        value={safeMusholla.radius}
                        onChange={handleMushollaChange}
                        className="mt-1 block w-full rounded-md border border-slate-600 bg-slate-900/50 p-2 text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-700/50 pt-4">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${safeMusholla.latitude},${safeMusholla.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 hover:underline"
                    >
                      Buka Lokasi di Google Maps &rarr;
                    </a>

                    <button
                      onClick={handleSaveMusholla}
                      disabled={isSavingMusholla}
                      className="inline-flex items-center justify-center rounded-md border border-transparent bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {isSavingMusholla ? "Menyimpan..." : "Simpan Musholla"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg glass-effect-dark-card p-6 shadow">
                <div className="mb-4 flex items-center gap-3">
                  <Info className="h-5 w-5 text-blue-400" />
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-slate-100">Aturan Presensi Sholat</h3>
                    <p className="mt-1 text-sm text-slate-400">Ringkasan aturan aktif yang dipakai sistem saat ini.</p>
                  </div>
                </div>

                <div className="space-y-3 text-sm text-slate-300">
                  <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-4">
                    Presensi sholat menggunakan titik lokasi musholla yang diatur pada kartu di atas.
                  </div>
                  <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-4">
                    Hari libur, hari Minggu, dan hari yang tidak diaktifkan pada jadwal sholat tidak masuk hitungan statistik maupun total wajib sholat.
                  </div>
                  <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-4">
                    Status HALANGAN dicatat sebagai pengecualian sehingga tidak menurunkan persentase sholat siswa maupun kelas.
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <HolidaySettingsCard />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
