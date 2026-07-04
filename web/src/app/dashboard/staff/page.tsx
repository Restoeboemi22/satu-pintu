"use client";

import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";

export default function StaffPage() {
  return (
    <div className="space-y-6">
      <div className="glass-effect-dark-card rounded-3xl p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 shadow-lg shadow-indigo-500/30">
            <Users className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-100">Manajemen Petugas OSIS</h1>
            <p className="text-slate-400 mt-1">Petugas OSIS adalah siswa yang diberi akses tambahan melalui Database.</p>
          </div>
        </div>
        <Link
          href="/admin/students?sub=staff"
          className="flex items-center gap-2 px-6 py-3 bg-white/5 text-slate-100 rounded-xl shadow-sm ring-1 ring-white/10 hover:bg-white/10 font-semibold"
        >
          Buka Database <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}
