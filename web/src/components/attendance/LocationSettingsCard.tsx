"use client";

import { useAttendanceStore } from "@/store/useAttendanceStore";
import { MapPin, Info, Save } from "lucide-react";
import { useState, useEffect } from "react";

export default function LocationSettingsCard() {
  const {
    location,
    updateLocation,
    saveLocationToFirebase,
    initLocationSync,
  } = useAttendanceStore();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = initLocationSync();
    return () => {
      unsubscribe();
    };
  }, [initLocationSync]);

  const safeLocation = location || { latitude: -7.6698, longitude: 112.5432, radius: 50 };

  const parseInputNumber = (raw: string): number | null => {
    const normalized = String(raw || "").trim().replace(",", ".");
    if (!normalized) return null;
    const value = Number.parseFloat(normalized);
    if (!Number.isFinite(value)) return null;
    return value;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const parsed = parseInputNumber(value);
    if (parsed === null) return;
    updateLocation({ [name]: parsed });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveLocationToFirebase();
      alert("Pengaturan lokasi berhasil disimpan ke Database!");
    } catch (error) {
      console.error("Failed to save location", error);
      const message = (error as any)?.message ? String((error as any).message) : String(error);
      alert(`Gagal menyimpan lokasi. ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg glass-effect-dark-card p-6 shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium leading-6 text-slate-100">Lokasi Sekolah</h3>
        <MapPin className="h-5 w-5 text-blue-400" />
      </div>

      <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-4">
        <div className="text-sm font-semibold text-slate-100">Lokasi Sekolah (Absensi)</div>
        <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <label htmlFor="latitude" className="block text-sm font-medium text-slate-300">Latitude</label>
            <input
              type="number"
              step="any"
              name="latitude"
              id="latitude"
              value={safeLocation.latitude}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-slate-600 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm border p-2 text-slate-100 bg-slate-900/50"
            />
          </div>
          <div>
            <label htmlFor="longitude" className="block text-sm font-medium text-slate-300">Longitude</label>
            <input
              type="number"
              step="any"
              name="longitude"
              id="longitude"
              value={safeLocation.longitude}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-slate-600 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm border p-2 text-slate-100 bg-slate-900/50"
            />
          </div>
          <div>
            <label htmlFor="radius" className="block text-sm font-medium text-slate-300">Radius (Meter)</label>
            <input
              type="number"
              name="radius"
              id="radius"
              value={safeLocation.radius}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-slate-600 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm border p-2 text-slate-100 bg-slate-900/50"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-700/50 pt-4">
          <a 
            href={`https://www.google.com/maps/search/?api=1&query=${safeLocation.latitude},${safeLocation.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1"
          >
            Buka Lokasi di Google Maps &rarr;
          </a>
          
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Menyimpan..." : "Simpan Lokasi"}
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-md bg-blue-900/30 p-4 border border-blue-700/30">
        <div className="flex">
          <div className="flex-shrink-0">
            <Info className="h-5 w-5 text-blue-400" aria-hidden="true" />
          </div>
          <div className="ml-3 flex-1 md:flex md:justify-between">
            <p className="text-sm text-blue-300">
              Pastikan koordinat sesuai dengan titik lokasi di Google Maps. Siswa hanya dapat melakukan presensi jika berada
              dalam radius yang ditentukan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
