"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useStudentStore } from "@/store/useStudentStore";
import { useClassStore } from "@/store/useClassStore";

function canonicalizeClassName(raw: unknown): string {
  const base = String(raw || "")
    .toUpperCase()
    .replace(/KELAS|CLASS/g, "")
    .trim();
  if (!base) return "";
  const m = base.match(/^(VIII|VII|IX|7|8|9)(?:\s*[-.]?\s*)?(.*)$/);
  if (!m) return base;
  let grade = String(m[1] || "").trim().toUpperCase();
  if (grade === "7") grade = "VII";
  if (grade === "8") grade = "VIII";
  if (grade === "9") grade = "IX";
  const suffix = String(m[2] || "").trim().replace(/^\-+/, "");
  if (!suffix) return grade;
  return `${grade}-${suffix}`;
}

function classKey(raw: unknown): string {
  const canonical = canonicalizeClassName(raw);
  return canonical.replace(/[^A-Z0-9]/g, "").toLowerCase();
}

export default function LenteraMembersPage() {
  const { user, _hasHydrated } = useAuthStore();
  const { students, loading, syncStudents } = useStudentStore();
  const { classes, subscribeToClasses } = useClassStore();

  const [query, setQuery] = useState("");
  const [selectedClassKey, setSelectedClassKey] = useState("");

  useEffect(() => {
    if (!_hasHydrated) return;
    const unsubStudents = syncStudents();
    const sid = String(user?.schoolId || "").trim();
    const unsubClasses = sid ? subscribeToClasses(sid) : () => {};
    return () => {
      try {
        unsubStudents();
      } catch {}
      try {
        unsubClasses();
      } catch {}
    };
  }, [_hasHydrated, subscribeToClasses, syncStudents, user?.schoolId]);

  const classOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    classes
      .map((c) => String(c.name || "").trim())
      .filter(Boolean)
      .forEach((rawName) => {
      const label = canonicalizeClassName(rawName) || rawName;
      const key = classKey(label);
      if (!key) return;
      if (!byKey.has(key)) byKey.set(key, label);
    });

    return Array.from(byKey.entries())
      .map(([key, label]) => ({ key, label }));
  }, [classes]);

  const classLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    classOptions.forEach((c) => map.set(c.key, c.label));
    return map;
  }, [classOptions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const clsKey = selectedClassKey.trim();
    return students.filter((s) => {
      const name = String(s.name || "").toLowerCase();
      const nisn = String((s as any).nisn || s.id || "");
      const sClass = String((s as any).class || "").trim();

      const matchQuery = !q || name.includes(q) || nisn.includes(q);
      const matchClass = !clsKey || classKey(sClass) === clsKey;
      return matchQuery && matchClass;
    });
  }, [query, selectedClassKey, students]);

  if (!_hasHydrated) return <div className="min-h-screen bg-slate-950" />;

  return (
    <div className="space-y-6">
      <div className="glass-effect-dark-card rounded-2xl border border-slate-700/60 p-5 shadow-xl backdrop-blur sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 ring-1 ring-sky-400/25">
                <Users className="h-5 w-5 text-sky-200" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-100">Data Anggota</h1>
                <p className="mt-1 text-sm text-slate-300">
                  Data siswa terhubung otomatis dari DATABASE (master_students){user?.schoolName ? ` — ${user.schoolName}` : ""}.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/students?sub=students"
              className="inline-flex items-center justify-center rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900/60 hover:text-white"
            >
              Buka DATABASE
            </Link>
          </div>
        </div>
      </div>

      <div className="glass-effect-dark-card rounded-2xl border border-slate-700/60 p-5 shadow-xl backdrop-blur sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/50 px-4 py-2.5">
              <Search className="h-5 w-5 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama atau NISN..."
                className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
              />
            </div>

            <select
              value={selectedClassKey}
              onChange={(e) => setSelectedClassKey(e.target.value)}
              className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-4 py-2.5 text-sm font-semibold text-slate-200 outline-none"
            >
              <option value="">Semua Kelas</option>
              {classOptions.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm text-slate-300">
            Total: <span className="font-semibold text-white">{filtered.length}</span>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-700/60">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-900/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Nama</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">NISN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Kelas</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                {loading ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-slate-300" colSpan={4}>
                      Memuat data...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-slate-300" colSpan={4}>
                      Tidak ada data anggota.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => {
                    const nisn = String((s as any).nisn || s.id || "");
                    const clsRaw = String((s as any).class || "").trim();
                    const cls = classLabelByKey.get(classKey(clsRaw)) || canonicalizeClassName(clsRaw) || clsRaw;
                    const status = String((s as any).status || "active");
                    const inactive = status === "inactive";
                    return (
                      <tr key={nisn} className="hover:bg-slate-900/40">
                        <td className="px-4 py-3 text-sm font-semibold text-slate-100">{s.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-300">{nisn}</td>
                        <td className="px-4 py-3 text-sm text-slate-300">{cls || "-"}</td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                              inactive ? "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/20" : "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20"
                            }`}
                          >
                            {inactive ? "Nonaktif" : "Aktif"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
