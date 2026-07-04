"use client";

import { useState, useEffect } from "react";
import { useAttendanceStore } from "@/store/useAttendanceStore";
import { Calendar, Trash2, Plus } from "lucide-react";

export default function HolidaySettingsCard() {
  const { holidays, addHoliday, removeHoliday, initHolidaySync } = useAttendanceStore();
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");

  // Initialize Firebase Sync
  useEffect(() => {
    const unsubscribe = initHolidaySync();
    return () => unsubscribe();
  }, [initHolidaySync]);

  const safeHolidays = holidays || [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !description) return;

    try {
      await addHoliday({ date, description });
      setDate("");
      setDescription("");
      alert("Hari libur berhasil ditambahkan!");
    } catch (error) {
      console.error("Failed to add holiday", error);
      const message = (error as any)?.message ? String((error as any).message) : String(error);
      alert(`Gagal menambahkan hari libur. ${message}`);
    }
  };

  return (
    <div className="rounded-lg glass-effect-dark-card p-6 shadow">
      <h3 className="text-lg font-medium leading-6 text-slate-100 mb-4">Hari Libur & Tanggal Merah</h3>
      
      <form onSubmit={handleAdd} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="holiday-date" className="block text-sm font-medium text-slate-300">Tanggal</label>
          <input
            type="date"
            id="holiday-date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block w-full rounded-md border-slate-600 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm border p-2 text-slate-100 bg-slate-900/50"
            required
          />
        </div>
        <div className="flex-[2]">
          <label htmlFor="holiday-desc" className="block text-sm font-medium text-slate-300">Keterangan</label>
          <input
            type="text"
            id="holiday-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contoh: Hari Kemerdekaan RI"
            className="mt-1 block w-full rounded-md border-slate-600 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm border p-2 text-slate-100 bg-slate-900/50"
            required
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md border border-transparent bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Plus className="-ml-1 mr-2 h-4 w-4" />
          Tambah
        </button>
      </form>

      <div className="flow-root">
        <ul className="-my-5 divide-y divide-slate-700">
          {safeHolidays.length === 0 && (
            <li className="py-5">
              <div className="text-center text-sm text-slate-500 italic">Belum ada data hari libur.</div>
            </li>
          )}
          {safeHolidays.sort((a, b) => a.date.localeCompare(b.date)).map((holiday) => (
            <li key={holiday.id} className="py-4">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <Calendar className="h-6 w-6 text-red-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">{holiday.description}</p>
                  <p className="truncate text-sm text-slate-400">
                    {new Date(holiday.date).toLocaleDateString('id-ID', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
                <div>
                  <button
                    onClick={async () => {
                      try {
                        await removeHoliday(holiday.id);
                      } catch (error) {
                        console.error("Failed to remove holiday", error);
                        const message = (error as any)?.message ? String((error as any).message) : String(error);
                        alert(`Gagal menghapus hari libur. ${message}`);
                      }
                    }}
                    className="inline-flex items-center rounded-full bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
