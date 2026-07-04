"use client";

import { useState } from "react";
import { useAttendanceStore } from "@/store/useAttendanceStore";
import { MapPin, Smartphone, ShieldAlert, CheckCircle, XCircle } from "lucide-react";

export default function AttendanceSimulationCard() {
  const { checkIn, attendanceLog } = useAttendanceStore();
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [isMock, setIsMock] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; distance?: number } | null>(null);

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude.toString());
          setLng(position.coords.longitude.toString());
        },
        (error) => {
          alert("Gagal mendapatkan lokasi: " + error.message);
        }
      );
    } else {
      alert("Geolocation tidak didukung browser ini.");
    }
  };

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lat || !lng) return;

    // Simulate a student ID
    const simStudentId = "SIM-001";
    const simStudentName = "Siswa Simulasi";

    const res = checkIn(
      simStudentId, 
      simStudentName, 
      parseFloat(lat), 
      parseFloat(lng), 
      isMock
    );
    setResult(res);
  };

  return (
    <div className="rounded-lg glass-effect-dark-card p-6 shadow border-2 border-dashed border-slate-600">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium leading-6 text-slate-100 flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-purple-400" />
          Simulasi Aplikasi Siswa
        </h3>
        <span className="text-xs font-semibold px-2 py-1 bg-purple-900/30 text-purple-400 rounded border border-purple-700/30">TEST MODE</span>
      </div>
      
      <p className="text-sm text-slate-400 mb-6">
        Gunakan formulir ini untuk menguji logika "Anti Fake GPS" dan validasi jarak yang akan digunakan di Aplikasi Siswa.
      </p>

      <form onSubmit={handleSimulate} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-300">Latitude (Siswa)</label>
            <input
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="mt-1 block w-full rounded-md border-slate-600 shadow-sm border p-2 text-sm text-slate-100 bg-slate-900/50"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">Longitude (Siswa)</label>
            <input
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className="mt-1 block w-full rounded-md border-slate-600 shadow-sm border p-2 text-sm text-slate-100 bg-slate-900/50"
              required
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleGetCurrentLocation}
            className="text-sm text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
          >
            <MapPin className="h-4 w-4" />
            Ambil Lokasi Saya Saat Ini
          </button>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isMock}
              onChange={(e) => setIsMock(e.target.checked)}
              className="rounded border-slate-600 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-slate-300 flex items-center gap-1">
              <ShieldAlert className="h-4 w-4 text-orange-400" />
              Simulasi "Fake GPS"
            </span>
          </label>
        </div>

        <button
          type="submit"
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
        >
          Tes Absensi
        </button>
      </form>

      {result && (
        <div className={`mt-6 p-4 rounded-md border ${result.success ? 'bg-green-900/30 border-green-700/30' : 'bg-red-900/30 border-red-700/30'}`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : (
                <XCircle className="h-5 w-5 text-red-400" />
              )}
            </div>
            <div className="ml-3">
              <h3 className={`text-sm font-semibold ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                {result.success ? 'Absensi Diterima' : 'Absensi Ditolak'}
              </h3>
              <div className={`mt-2 text-sm ${result.success ? 'text-green-300' : 'text-red-300'}`}>
                <p>{result.message}</p>
                {result.distance !== undefined && (
                  <p className="mt-1 font-mono text-xs">Jarak dari sekolah: {Math.round(result.distance)} meter</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Preview */}
      {attendanceLog.length > 0 && (
        <div className="mt-8 border-t border-slate-700 pt-4">
          <h4 className="text-sm font-semibold text-slate-200 mb-2">Log Absensi Terakhir (Lokal)</h4>
          <div className="space-y-2">
            {attendanceLog.slice(0, 3).map((log) => (
              <div key={log.id} className="text-xs text-slate-400 bg-slate-800/30 p-2 rounded flex justify-between">
                <span>{log.studentName}</span>
                <span>{new Date(log.date).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
