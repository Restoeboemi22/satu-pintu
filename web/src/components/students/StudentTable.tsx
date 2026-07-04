"use client";

import { useState } from "react";
import { Student } from "@/types/student";
import { Search, Smartphone } from "lucide-react";

interface StudentTableProps {
  students: Student[];
}

export default function StudentTable({ students }: StudentTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredStudents = students.filter((student) => {
    const matchesSearch = 
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.nisn.includes(searchTerm) ||
      (student.class || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 backdrop-blur-xl p-6 rounded-3xl border border-blue-700/30 shadow-xl">
        <div className="flex gap-4">
          <div className="p-3 rounded-2xl bg-blue-900/40 border border-blue-700/30">
            <Smartphone className="h-6 w-6 text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-300">
              Data siswa ini terhubung dengan Aplikasi Siswa.
            </p>
            <p className="text-sm text-blue-200 mt-1">
              Username: Nama Lengkap (Sesuai Data) | Password: NISN
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-6">
          <Search className="h-6 w-6 text-slate-500" />
        </div>
        <input
          type="text"
          className="block w-full rounded-2xl border-0 py-4 pl-16 pr-6 text-slate-100 bg-slate-900/60 backdrop-blur-xl shadow-xl border border-slate-700/50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
          placeholder="Cari nama, NISN, atau kelas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="glass-effect-dark-card rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700/30">
            <thead className="bg-gradient-to-r from-slate-900/70 to-slate-900/50">
              <tr>
                <th scope="col" className="px-8 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  NISN
                </th>
                <th scope="col" className="px-8 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  Nama Lengkap
                </th>
                <th scope="col" className="px-8 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  L/P
                </th>
                <th scope="col" className="px-8 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  Kelas
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-900/30 divide-y divide-slate-700/30">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-800/30 transition-colors duration-200">
                    <td className="whitespace-nowrap px-8 py-5">
                      <div className="text-sm font-semibold text-slate-200">{student.nisn}</div>
                    </td>
                    <td className="whitespace-nowrap px-8 py-5">
                      <div className="text-sm font-semibold text-slate-100">{student.name}</div>
                      <div className="text-xs text-slate-500 mt-1">{student.email || "-"}</div>
                    </td>
                    <td className="whitespace-nowrap px-8 py-5">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border ${
                        student.gender === "L" 
                          ? "bg-blue-900/30 text-blue-300 border-blue-700/30" 
                          : "bg-pink-900/30 text-pink-300 border-pink-700/30"
                      }`}>
                        {student.gender}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-8 py-5">
                      <span className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-blue-500/30">
                        {student.class || "-"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-8 py-16 text-center">
                    <div className="text-slate-500 font-semibold">Tidak ada data siswa yang ditemukan.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-sm text-slate-400 font-medium">
        Menampilkan <span className="text-blue-400 font-bold">{filteredStudents.length}</span> dari <span className="text-slate-200 font-bold">{students.length}</span> siswa
      </div>
    </div>
  );
}
