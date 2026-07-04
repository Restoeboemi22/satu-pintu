"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { edulockDb } from "@/lib/edulockFirebase";
import { callEduLockSuperApi } from "@/lib/callEduLockSuperApi";
import { useAuthStore } from "@/store/useAuthStore";
import { useEduLockAuth } from "@/lib/useEduLockAuth";

type SchoolRow = {
  schoolId: string;
  name: string;
  district: string;
  npsn: string;
  authEmail: string;
  adminEmail: string;
  backupEmail: string;
  isActive: boolean;
  createdAt?: number | null;
  updatedAt?: number | null;
};

function normalize(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSchoolScope(value: unknown): string {
  return normalize(value).toLowerCase();
}

function formatTs(ts?: number | null): string {
  if (!ts || typeof ts !== "number") return "-";
  return new Date(ts).toLocaleString("id-ID");
}

export default function GasSuperAdminTenantsPage() {
  const { user } = useAuthStore();
  const { isLoading: isEduLockAuthLoading } = useEduLockAuth();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isEduLockAuthLoading) return;
    setLoading(true);
    setError("");
    const unsub = onValue(
      ref(edulockDb, "schools"),
      (snapshot) => {
        const data = snapshot.val();
        if (!data || typeof data !== "object") {
          setRows([]);
          setLoading(false);
          return;
        }

        const list: SchoolRow[] = Object.entries(data).map(([key, v]: any) => ({
          schoolId: normalizeSchoolScope(v?.schoolId || key),
          name: v?.name ? String(v.name) : "",
          district: v?.district ? String(v.district) : "",
          npsn: v?.npsn ? String(v.npsn) : "",
          authEmail: v?.authEmail ? String(v.authEmail) : "",
          adminEmail: v?.adminEmail ? String(v.adminEmail) : "",
          backupEmail: v?.backupEmail ? String(v.backupEmail) : "",
          isActive: v?.isActive !== false,
          createdAt: typeof v?.createdAt === "number" ? v.createdAt : null,
          updatedAt: typeof v?.updatedAt === "number" ? v.updatedAt : null,
        }));
        list.sort((a, b) => String(a.name || a.schoolId).localeCompare(String(b.name || b.schoolId)));
        setRows(list);
        setLoading(false);
      },
      (e) => {
        setError(String((e as any)?.message || e || "Gagal memuat data schools."));
        setRows([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [isEduLockAuthLoading]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.isActive).length;
    return { total, active, inactive: Math.max(0, total - active) };
  }, [rows]);

  const filtered = useMemo(() => {
    const query = normalize(q).toLowerCase();
    if (!query) return rows;
    return rows.filter((r) => {
      const hay = [
        r.schoolId,
        r.name,
        r.district,
        r.npsn,
        r.authEmail,
        r.adminEmail,
        r.backupEmail,
      ]
        .map((x) => normalize(x).toLowerCase())
        .join(" ");
      return hay.includes(query);
    });
  }, [q, rows]);

  const toggleActive = async (sid: string, next: boolean) => {
    const schoolId = normalizeSchoolScope(sid);
    if (!schoolId) return;
    setBusyId(schoolId);
    setError("");
    try {
      await callEduLockSuperApi("PUT", {
        action: "toggle-school-active",
        schoolId,
        nextActive: next,
      });
    } catch (e: any) {
      setError(String(e?.message || e || "Gagal update status sekolah."));
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-slate-900/60 p-6 shadow-xl border border-slate-700/50 backdrop-blur-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Sekolah & Tenant</h1>
            <p className="mt-1 text-sm text-slate-300">
              Kontrol enable/disable GAS per sekolah dan status integrasi lintas tenant.
            </p>
          </div>
          <Link
            href="/dashboard/super"
            className="inline-flex items-center justify-center rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-900/60"
          >
            Kembali
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl bg-slate-900/60 p-6 shadow-xl border border-slate-700/50 backdrop-blur-2xl">
          <div className="text-xs font-semibold tracking-widest text-slate-400">TENANTS</div>
          <div className="mt-1 text-2xl font-bold text-slate-100">{stats.total}</div>
          <div className="mt-1 text-sm text-slate-300">Total sekolah</div>
        </div>
        <div className="rounded-3xl bg-slate-900/60 p-6 shadow-xl border border-slate-700/50 backdrop-blur-2xl">
          <div className="text-xs font-semibold tracking-widest text-slate-400">AKTIF</div>
          <div className="mt-1 text-2xl font-bold text-slate-100">{stats.active}</div>
          <div className="mt-1 text-sm text-slate-300">Sekolah aktif</div>
        </div>
        <div className="rounded-3xl bg-slate-900/60 p-6 shadow-xl border border-slate-700/50 backdrop-blur-2xl">
          <div className="text-xs font-semibold tracking-widest text-slate-400">NONAKTIF</div>
          <div className="mt-1 text-2xl font-bold text-slate-100">{stats.inactive}</div>
          <div className="mt-1 text-sm text-slate-300">Sekolah nonaktif</div>
        </div>
      </div>

      <div className="rounded-3xl bg-slate-900/60 p-6 shadow-xl border border-slate-700/50 backdrop-blur-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-100">Tenant Registry (Realtime)</div>
            <div className="mt-1 text-sm text-slate-300">
              Sumber data: <span className="font-semibold text-slate-200">schools</span>
            </div>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari schoolId / nama / NPSN / email..."
            className="w-full sm:w-80 rounded-xl border border-slate-700/50 bg-slate-950/30 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs font-semibold tracking-widest text-slate-400">
                <th className="px-3 py-2">SCHOOL ID</th>
                <th className="px-3 py-2">NAMA</th>
                <th className="px-3 py-2">NPSN</th>
                <th className="px-3 py-2">KECAMATAN</th>
                <th className="px-3 py-2">UPDATED</th>
                <th className="px-3 py-2 text-right">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-sm text-slate-300">
                    Memuat...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-sm text-slate-300">
                    Data tidak ditemukan.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const disabled = busyId === r.schoolId;
                  return (
                    <tr key={r.schoolId} className="bg-slate-950/20 border border-slate-700/40">
                      <td className="px-3 py-3 text-sm font-semibold text-slate-100">
                        {r.schoolId}
                        <div className="mt-1 text-xs text-slate-400">{r.authEmail || r.adminEmail || "-"}</div>
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-100">
                        {r.name || "-"}
                        <div className="mt-1 text-xs text-slate-400">{r.backupEmail || "-"}</div>
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-100">{r.npsn || "-"}</td>
                      <td className="px-3 py-3 text-sm text-slate-100">{r.district || "-"}</td>
                      <td className="px-3 py-3 text-sm text-slate-100">{formatTs(r.updatedAt || r.createdAt)}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleActive(r.schoolId, !r.isActive)}
                          className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition border ${
                            r.isActive
                              ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/20"
                              : "border-red-400/30 bg-red-500/15 text-red-100 hover:bg-red-500/20"
                          } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          {r.isActive ? "Aktif" : "Nonaktif"}
                        </button>
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
  );
}
