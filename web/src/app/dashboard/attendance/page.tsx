"use client";

import { useEffect, useState } from "react";
import EffectiveDaysCard from "@/components/attendance/EffectiveDaysCard";
import HolidaySettingsCard from "@/components/attendance/HolidaySettingsCard";
import LocationSettingsCard from "@/components/attendance/LocationSettingsCard";
import AttendanceSimulationCard from "@/components/attendance/AttendanceSimulationCard";
import AttendanceRecap from "@/components/attendance/AttendanceRecap";
import AttendanceStatistics from "@/components/attendance/AttendanceStatistics";
import { useAuthStore } from "@/store/useAuthStore";

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState<"monitoring" | "statistics" | "settings">("monitoring");
  const { user } = useAuthStore();
  const canViewStatistics = user?.role === "admin";
  const canManageSettings = user?.role === "admin" || user?.role === "super_admin";

  useEffect(() => {
    if (activeTab === "statistics" && !canViewStatistics) {
      setActiveTab("monitoring");
    }
    if (activeTab === "settings" && !canManageSettings) {
      setActiveTab("monitoring");
    }
  }, [activeTab, canManageSettings, canViewStatistics]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Manajemen Presensi</h1>
        <p className="mt-1 text-sm text-slate-400">
          Monitoring kehadiran siswa dan pengaturan sistem presensi sekolah.
        </p>
        
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
          <AttendanceRecap />
        ) : activeTab === "statistics" && canViewStatistics ? (
          <AttendanceStatistics />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left Column */}
            <div className="space-y-6">
              <EffectiveDaysCard />
              <LocationSettingsCard />
              <AttendanceSimulationCard />
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <HolidaySettingsCard />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
