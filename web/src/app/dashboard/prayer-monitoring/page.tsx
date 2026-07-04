"use client";

import PrayerRecap from "@/components/attendance/PrayerRecap";

export default function PrayerRecapPage() {
  return (
    <div className="min-h-screen p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Rekap Sholat</h1>

      <div className="glass-effect-dark-card rounded-lg p-6">
        <PrayerRecap />
      </div>
    </div>
  );
}
