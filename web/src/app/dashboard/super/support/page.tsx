"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { limitToLast, onValue, orderByChild, query, ref } from "firebase/database";
import { edulockDb } from "@/lib/edulockFirebase";
import { callEduLockSuperApi } from "@/lib/callEduLockSuperApi";

type SupportActionType = "clear_cache" | "rerun_sync" | "reset_access";
type SupportStatus = "OPEN" | "DONE" | "CANCELLED";

type SupportRequestRow = {
  id: string;
  type: SupportActionType;
  schoolId: string;
  reason?: string;
  status: SupportStatus;
  createdAt: number | null;
  updatedAt: number | null;
  createdBy?: string;
  updatedBy?: string;
};

function normalize(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSchoolScope(value: unknown): string {
  return normalize(value).toLowerCase();
}

export default function GasSuperAdminSupportPage() {
  const [rows, setRows] = useState<SupportRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const [type, setType] = useState<SupportActionType>("clear_cache");
  const [schoolId, setSchoolId] = useState("");
  const [reason, setReason] = useState("");

  const basePath = "gas/support_requests";

  useEffect(() => {
    setLoading(true);
    setError("");
    const q = query(ref(edulockDb, basePath), orderByChild("createdAt"), limitToLast(200));
    const unsub = onValue(
      q,
      (snap) => {
        const data = snap.val();
        if (!data || typeof data !== "object") {
          setRows([]);
          setLoading(false);
          return;
        }
        const list: SupportRequestRow[] = Object.entries(data).map(([key, v]: any) => ({
          id: String(v?.id || key || ""),
          type: String(v?.type || "clear_cache") as SupportActionType,
          schoolId: normalizeSchoolScope(v?.schoolId),
          reason: v?.reason ? String(v.reason) : undefined,
          status: String(v?.status || "OPEN") as SupportStatus,
          createdAt: typeof v?.createdAt === "number" ? v.createdAt : null,
          updatedAt: typeof v?.updatedAt === "number" ? v.updatedAt : null,
          createdBy: v?.createdBy ? String(v.createdBy) : undefined,
          updatedBy: v?.updatedBy ? String(v.updatedBy) : undefined,
        }));
        list.sort((a, b) => (Number(b.createdAt || 0) || 0) - (Number(a.createdAt || 0) || 0));
        setRows(list);
        setLoading(false);
      },
      (e) => {
        setError(String((e as any)?.message || e || "Gagal memuat support requests."));
        setRows([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    const open = rows.filter((r) => r.status === "OPEN").length;
    return { total: rows.length, open };
  }, [rows]);

  const createRequest = async () => {
    setError("");
    const sid = normalizeSchoolScope(schoolId);
    if (!sid) {
      setError("schoolId wajib diisi.");
      return;
    }
    try {
      await callEduLockSuperApi("POST", {
        action: "create-support-request",
        supportRequest: {
          type,
          schoolId: sid,
          reason: normalize(reason) || null,
        },
      });
      setReason("");
    } catch (e: any) {
      setError(String(e?.message || e || "Gagal membuat request."));
    }
  };

  const setStatus = async (id: string, status: SupportStatus) => {
    const rid = normalize(id);
    if (!rid) return;
    setBusyId(rid);
    setError("");
    try {
      await callEduLockSuperApi("PUT", {
        action: "set-support-request-status",
        targetId: rid,
        supportRequest: {
          status,
        },
      });
    } catch (e: any) {
      setError(String(e?.message || e || "Gagal update status."));
    } finally {
      setBusyId("");
    }
  };

  const deleteRequest = async (id: string) => {
    const rid = normalize(id);
    if (!rid) return;
    setBusyId(rid);
    setError("");
    try {
      await callEduLockSuperApi("DELETE", {
        action: "delete-support-request",
        targetId: rid,
      });
    } catch (e: any) {
      setError(String(e?.message || e || "Gagal menghapus request."));
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-slate-900/60 p-6 shadow-xl border border-slate-700/50 backdrop-blur-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Support Tools</h1>
            <p className="mt-1 text-sm text-slate-300">
              Panel ini membuat antrian request support per tenant. Eksekusi tetap membutuhkan proses operator/backend terpisah.
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl bg-slate-900/60 p-6 shadow-xl border border-slate-700/50 backdrop-blur-2xl">
          <div className="text-xs font-semibold tracking-widest text-slate-400">REQUESTS</div>
          <div className="mt-1 text-2xl font-bold text-slate-100">{stats.total}</div>
          <div className="mt-1 text-sm text-slate-300">Total</div>
        </div>
        <div className="rounded-3xl bg-slate-900/60 p-6 shadow-xl border border-slate-700/50 backdrop-blur-2xl">
          <div className="text-xs font-semibold tracking-widest text-slate-400">OPEN</div>
          <div className="mt-1 text-2xl font-bold text-slate-100">{stats.open}</div>
          <div className="mt-1 text-sm text-slate-300">Belum selesai</div>
        </div>
      </div>

      <div className="rounded-3xl bg-slate-900/60 p-6 shadow-xl border border-slate-700/50 backdrop-blur-2xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">Support Request Queue (Realtime)</div>
            <div className="mt-1 text-sm text-slate-300">
              Sumber data: <span className="font-semibold text-slate-200">{basePath}</span>
            </div>
            <div className="mt-1 text-xs text-amber-200">
              `OPEN`, `DONE`, dan `CANCELLED` adalah status antrian/operator, bukan bukti aksi backend sudah dieksekusi otomatis.
            </div>
          </div>
          <div className="text-xs text-slate-400">{loading ? "Memuat..." : "Live"}</div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <div className="text-xs font-semibold tracking-widest text-slate-400">TIPE</div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SupportActionType)}
              className="mt-2 w-full rounded-xl border border-slate-700/50 bg-slate-950/30 px-4 py-2 text-sm text-slate-100"
            >
              <option value="clear_cache">clear_cache</option>
              <option value="rerun_sync">rerun_sync</option>
              <option value="reset_access">reset_access</option>
            </select>
          </div>
          <div>
            <div className="text-xs font-semibold tracking-widest text-slate-400">SCHOOL ID</div>
            <input
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-700/50 bg-slate-950/30 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              placeholder="contoh: smpn_3_pacet"
            />
          </div>
          <div className="sm:col-span-2">
            <div className="text-xs font-semibold tracking-widest text-slate-400">ALASAN</div>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-700/50 bg-slate-950/30 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              placeholder="opsional"
            />
          </div>
        </div>
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={createRequest}
            className="inline-flex items-center justify-center rounded-xl border border-blue-500/40 bg-blue-500/15 px-4 py-2 text-sm font-semibold text-blue-100 hover:bg-blue-500/20"
          >
            Buat Antrian
          </button>
        </div>
      </div>

      <div className="rounded-3xl bg-slate-900/60 p-6 shadow-xl border border-slate-700/50 backdrop-blur-2xl space-y-4">
        <div className="text-sm font-semibold text-slate-100">Daftar Antrian Support</div>
        <div className="space-y-2">
          {loading ? (
            <div className="text-sm text-slate-300">Memuat...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-slate-300">Belum ada request.</div>
          ) : (
            rows.slice(0, 30).map((r) => {
              const disabled = busyId === r.id;
              return (
                <div key={r.id} className="rounded-2xl border border-slate-700/40 bg-slate-950/20 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-slate-100">{r.type}</div>
                        <span
                          className={`inline-flex rounded-xl border px-3 py-1 text-xs font-semibold ${
                            r.status === "DONE"
                              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                              : r.status === "CANCELLED"
                                ? "border-red-400/30 bg-red-500/10 text-red-100"
                                : "border-slate-600/50 bg-slate-800/30 text-slate-100"
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-slate-300">schoolId: {r.schoolId}</div>
                      {r.reason ? <div className="mt-1 text-sm text-slate-300">{r.reason}</div> : null}
                      <div className="mt-2 text-xs text-slate-400">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString("id-ID") : "-"} · {r.createdBy || "-"}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setStatus(r.id, "DONE")}
                        className={`rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/15 ${
                          disabled ? "opacity-60 cursor-not-allowed" : ""
                        }`}
                      >
                        DONE
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setStatus(r.id, "CANCELLED")}
                        className={`rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-500/15 ${
                          disabled ? "opacity-60 cursor-not-allowed" : ""
                        }`}
                      >
                        CANCEL
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => deleteRequest(r.id)}
                        className={`rounded-xl border border-slate-700/50 bg-slate-950/20 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-950/30 ${
                          disabled ? "opacity-60 cursor-not-allowed" : ""
                        }`}
                      >
                        HAPUS
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
