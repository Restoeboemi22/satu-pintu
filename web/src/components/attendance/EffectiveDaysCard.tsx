"use client";

import { useAttendanceStore } from "@/store/useAttendanceStore";
import { Check, Clock, Save } from "lucide-react";
import { useState, useEffect } from "react";

export default function EffectiveDaysCard() {
  const { schedules, updateSchedule, initScheduleSync, saveScheduleToFirebase } = useAttendanceStore();
  const [isSaving, setIsSaving] = useState(false);

  // Initialize Firebase Sync
  useEffect(() => {
    const unsubscribe = initScheduleSync();
    return () => unsubscribe();
  }, [initScheduleSync]);

  // If schedules is undefined (due to hydration or old state), use fallback or loading
  if (!schedules) {
    return <div className="rounded-lg glass-effect-dark-card p-6 shadow animate-pulse h-64"></div>;
  }

  const handleToggle = (dayId: number, current: boolean) => {
    updateSchedule(dayId, { isEnabled: !current });
  };

  const handleTimeChange = (dayId: number, field: 'entryTime' | 'exitTime', value: string) => {
    updateSchedule(dayId, { [field]: value });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveScheduleToFirebase();
      alert("Jadwal efektif berhasil disimpan dan disinkronkan ke Cloud!");
    } catch (error) {
      console.error("Failed to save schedule", error);
      alert("Gagal menyimpan jadwal ke Cloud.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg glass-effect-dark-card p-6 shadow">
      <div className="flex items-center justify-between mb-4">
        <div>
           <h3 className="text-lg font-medium leading-6 text-slate-100">Jadwal & Hari Efektif</h3>
           <p className="text-sm text-slate-400 mt-1">Atur hari masuk sekolah dan jam operasional.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center justify-center rounded-md border border-transparent bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {isSaving ? "..." : "Simpan"}
        </button>
      </div>
      
      <div className="space-y-3">
        {schedules.map((schedule) => (
          <div 
            key={schedule.dayId}
            className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border transition-all ${
              schedule.isEnabled 
                ? "border-blue-700/30 bg-blue-900/30" 
                : "border-slate-700/30 bg-slate-800/30 opacity-75"
            }`}
          >
            <div className="flex items-center gap-3 mb-3 sm:mb-0 min-w-[120px]">
              <button
                onClick={() => handleToggle(schedule.dayId, schedule.isEnabled)}
                className={`flex h-6 w-6 items-center justify-center rounded border transition-colors ${
                  schedule.isEnabled
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-slate-600 bg-slate-900"
                }`}
              >
                {schedule.isEnabled && <Check className="h-4 w-4" />}
              </button>
              <span className={`font-medium ${schedule.isEnabled ? "text-slate-100" : "text-slate-400"}`}>
                {schedule.dayName}
              </span>
            </div>

            {schedule.isEnabled && (
              <div className="flex items-center gap-4 flex-1 sm:justify-end">
                <div className="flex items-center gap-2">
                   <Clock className="h-4 w-4 text-slate-400 hidden sm:block" />
                   <div className="flex flex-col">
                      <label className="text-[10px] uppercase text-slate-400 font-semibold">Masuk</label>
                      <input 
                        type="time" 
                        value={schedule.entryTime}
                        onChange={(e) => handleTimeChange(schedule.dayId, 'entryTime', e.target.value)}
                        className="text-sm border-slate-600 rounded-md focus:ring-blue-500 focus:border-blue-500 p-1 bg-slate-900/50 text-slate-100 w-24"
                      />
                   </div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="flex flex-col">
                      <label className="text-[10px] uppercase text-slate-400 font-semibold">Pulang</label>
                      <input 
                        type="time" 
                        value={schedule.exitTime}
                        onChange={(e) => handleTimeChange(schedule.dayId, 'exitTime', e.target.value)}
                        className="text-sm border-slate-600 rounded-md focus:ring-blue-500 focus:border-blue-500 p-1 bg-slate-900/50 text-slate-100 w-24"
                      />
                   </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-400">
        Siswa hanya dapat melakukan absensi pada hari-hari yang diaktifkan. Jam Masuk dan Pulang digunakan untuk perhitungan keterlambatan dan durasi sekolah.
      </p>
    </div>
  );
}
