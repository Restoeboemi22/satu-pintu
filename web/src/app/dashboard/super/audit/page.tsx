"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { limitToLast, onValue, orderByChild, query, ref } from "firebase/database";
import { edulockDb } from "@/lib/edulockFirebase";

type AuditRow = {
  id: string;
  at: number | null;
  type: string;
  message: string;
  schoolId: string;
  targetUid: string;
  actorUid: string;
  actorEmail: string;
};

function normalize(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSchoolScope(value: unknown): string {
  return normalize(value).toLowerCase();
}

export default function GasSuperAdminAuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [onlyGas, setOnlyGas] = useState(false);

  const basePath = "platform_events";

  useEffect(() => {
    setLoading(true);
    setError("");
    const qRef = query(ref(edulockDb, basePath), orderByChild("at"), limitToLast(400));
    const unsub = onValue(
      qRef,
      (snap) => {
        const data = snap.val();
        if (!data || typeof data !== "object") {
          setRows([]);
          setLoading(false);
          return;
        }
        const list: AuditRow[] = Object.entries(data).map(([key, v]: any) => ({
          id: String(v?.id || key || ""),
          at: typeof v?.at === "number" ? v.at : null,
          type: v?.type ? String(v.type) : "",
          message: v?.message ? String(v.message) : "",
          schoolId: normalizeSchoolScope(v?.schoolId),
          targetUid: v?.targetUid ? String(v.targetUid) : "",
          actorUid: v?.actorUid ? String(v.actorUid) : "",
          actorEmail: v?.actorEmail ? String(v.actorEmail) : "",
        }));
        list.sort((a, b) => (Number(b.at || 0) || 0) - (Number(a.at || 0) || 0));
        setRows(list);
        setLoading(false);
      },
      (e) => {
        setError(String((e as any)?.message || e || "Gagal memuat audit."));
        setRows([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const queryText = normalize(q).toLowerCase();
    const base = onlyGas ? rows.filter((r) => normalize(r.type).toLowerCase().startsWith("gas.")) : rows;
    if (!queryText) return base;
    return base.filter((r) => {
      const hay = [r.type, r.message, r.schoolId, r.targetUid, r.actorUid, r.actorEmail]
        .map((x) => normalize(x).toLowerCase())
        .join(" ");
      return hay.includes(queryText);
    });
  }, [onlyGas, q, rows]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-slate-900/60 p-6 shadow-xl border border-slate-700/50 backdrop-blur-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Audit & Compliance</h1>
            <p className="mt-1 text-sm text-slate-300">
              Jejak aksi penting dan perubahan konfigurasi modul GAS lintas tenant.
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

      <div className="rounded-3xl bg-slate-900/60 p-6 shadow-xl border border-slate-700/50 backdrop-blur-2xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">Audit Feed (Realtime)</div>
            <div className="mt-1 text-sm text-slate-300">
              Sumber data: <span className="font-semibold text-slate-200">{basePath}</span> (400 terbaru)
            </div>
          </div>
          <div className="text-xs text-slate-400">{loading ? "Memuat..." : "Live"}</div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full sm:w-96 rounded-xl border border-slate-700/50 bg-slate-950/30 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            placeholder="Cari type / message / schoolId / actor..."
          />
          <button
            type="button"
            onClick={() => setOnlyGas((v) => !v)}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              onlyGas
                ? "border-blue-500/40 bg-blue-500/15 text-blue-100 hover:bg-blue-500/20"
                : "border-slate-700/50 bg-slate-950/20 text-slate-100 hover:bg-slate-950/30"
            }`}
          >
            {onlyGas ? "Filter: gas.*" : "Filter: semua"}
          </button>
          <div className="text-xs text-slate-400">
            Tampil: <span className="font-semibold text-slate-200">{filtered.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs font-semibold tracking-widest text-slate-400">
                <th className="px-3 py-2">WAKTU</th>
                <th className="px-3 py-2">TYPE</th>
                <th className="px-3 py-2">SCHOOL</th>
                <th className="px-3 py-2">AKTOR</th>
                <th className="px-3 py-2">PESAN</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-sm text-slate-300">
                    Memuat...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-sm text-slate-300">
                    Belum ada audit event.
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 250).map((r) => (
                  <tr key={r.id} className="bg-slate-950/20 border border-slate-700/40">
                    <td className="px-3 py-3 text-sm text-slate-100">
                      {r.at ? new Date(r.at).toLocaleString("id-ID") : "-"}
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-slate-100">{r.type || "-"}</td>
                    <td className="px-3 py-3 text-sm text-slate-100">{r.schoolId || "-"}</td>
                    <td className="px-3 py-3 text-sm text-slate-100">{r.actorEmail || r.actorUid || "-"}</td>
                    <td className="px-3 py-3 text-sm text-slate-100">{r.message || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
