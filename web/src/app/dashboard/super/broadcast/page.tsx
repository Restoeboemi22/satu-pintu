"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { limitToLast, onValue, orderByChild, query, ref } from "firebase/database";
import { edulockDb } from "@/lib/edulockFirebase";
import { callEduLockSuperApi } from "@/lib/callEduLockSuperApi";

type BroadcastTarget = { mode: "ALL" } | { mode: "SCHOOL"; schoolId: string };

type BroadcastRow = {
  id: string;
  title: string;
  message: string;
  target: BroadcastTarget;
  createdAt: number | null;
  createdBy?: string;
};

function normalize(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSchoolScope(value: unknown): string {
  return normalize(value).toLowerCase();
}

export default function GasSuperAdminBroadcastPage() {
  const [rows, setRows] = useState<BroadcastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetMode, setTargetMode] = useState<BroadcastTarget["mode"]>("ALL");
  const [targetSchoolId, setTargetSchoolId] = useState("");

  const basePath = "gas/broadcasts";

  useEffect(() => {
    setLoading(true);
    setError("");
    const q = query(ref(edulockDb, basePath), orderByChild("createdAt"), limitToLast(100));
    const unsub = onValue(
      q,
      (snap) => {
        const data = snap.val();
        if (!data || typeof data !== "object") {
          setRows([]);
          setLoading(false);
          return;
        }
        const list: BroadcastRow[] = Object.entries(data).map(([key, v]: any) => {
          const mode: BroadcastTarget["mode"] = v?.target?.mode === "SCHOOL" ? "SCHOOL" : "ALL";
          const target: BroadcastTarget =
            mode === "SCHOOL"
              ? { mode: "SCHOOL", schoolId: normalizeSchoolScope(v?.target?.schoolId) }
              : { mode: "ALL" };
          return {
            id: String(v?.id || key || ""),
            title: v?.title ? String(v.title) : "",
            message: v?.message ? String(v.message) : "",
            target,
            createdAt: typeof v?.createdAt === "number" ? v.createdAt : null,
            createdBy: v?.createdBy ? String(v.createdBy) : undefined,
          };
        });
        list.sort((a, b) => (Number(b.createdAt || 0) || 0) - (Number(a.createdAt || 0) || 0));
        setRows(list);
        setLoading(false);
      },
      (e) => {
        setError(String((e as any)?.message || e || "Gagal memuat broadcasts."));
        setRows([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const createBroadcast = async () => {
    setError("");
    const t = normalize(title);
    const m = normalize(message);
    if (!t || !m) {
      setError("Judul dan pesan wajib diisi.");
      return;
    }
    const target: BroadcastTarget =
      targetMode === "SCHOOL" ? { mode: "SCHOOL", schoolId: normalizeSchoolScope(targetSchoolId) } : { mode: "ALL" };
    if (target.mode === "SCHOOL" && !target.schoolId) {
      setError("schoolId wajib diisi untuk target SCHOOL.");
      return;
    }

    try {
      await callEduLockSuperApi("POST", {
        action: "create-broadcast",
        broadcast: {
          title: t,
          message: m,
          target,
        },
      });
      setTitle("");
      setMessage("");
      setTargetSchoolId("");
      setTargetMode("ALL");
    } catch (e: any) {
      setError(String(e?.message || e || "Gagal membuat broadcast."));
    }
  };

  const deleteBroadcast = async (id: string) => {
    const bid = normalize(id);
    if (!bid) return;
    setBusyId(bid);
    setError("");
    try {
      await callEduLockSuperApi("DELETE", {
        action: "delete-broadcast",
        targetId: bid,
      });
    } catch (e: any) {
      setError(String(e?.message || e || "Gagal menghapus broadcast."));
    } finally {
      setBusyId("");
    }
  };

  const previewTarget = useMemo(() => {
    if (targetMode === "ALL") return "ALL tenants";
    const sid = normalize(targetSchoolId);
    return sid ? `SCHOOL: ${sid}` : "SCHOOL: -";
  }, [targetMode, targetSchoolId]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-slate-900/60 p-6 shadow-xl border border-slate-700/50 backdrop-blur-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Broadcast Global</h1>
            <p className="mt-1 text-sm text-slate-300">
              Panel ini menulis antrian broadcast lintas sekolah. Delivery aktual tetap bergantung pada worker/channel notifikasi yang terpisah.
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
            <div className="text-sm font-semibold text-slate-100">Buat Antrian Broadcast (Realtime)</div>
            <div className="mt-1 text-sm text-slate-300">
              Sumber data: <span className="font-semibold text-slate-200">{basePath}</span>
            </div>
            <div className="mt-1 text-xs text-slate-400">Target: {previewTarget}</div>
            <div className="mt-1 text-xs text-amber-200">
              Record yang dibuat di sini adalah antrian broadcast, bukan jaminan notifikasi sudah ter-deliver ke seluruh tenant.
            </div>
          </div>
          <div className="text-xs text-slate-400">{loading ? "Memuat..." : "Live"}</div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold tracking-widest text-slate-400">JUDUL</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-700/50 bg-slate-950/30 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              placeholder="Contoh: Maintenance"
            />
          </div>
          <div>
            <div className="text-xs font-semibold tracking-widest text-slate-400">TARGET</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select
                value={targetMode}
                onChange={(e) => setTargetMode(e.target.value as BroadcastTarget["mode"])}
                className="w-full rounded-xl border border-slate-700/50 bg-slate-950/30 px-4 py-2 text-sm text-slate-100"
              >
                <option value="ALL">ALL</option>
                <option value="SCHOOL">SCHOOL</option>
              </select>
              <input
                value={targetSchoolId}
                onChange={(e) => setTargetSchoolId(e.target.value)}
                disabled={targetMode !== "SCHOOL"}
                className={`w-full rounded-xl border border-slate-700/50 bg-slate-950/30 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 ${
                  targetMode !== "SCHOOL" ? "opacity-60 cursor-not-allowed" : ""
                }`}
                placeholder="schoolId"
              />
            </div>
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold tracking-widest text-slate-400">PESAN</div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mt-2 min-h-[120px] w-full rounded-2xl border border-slate-700/50 bg-slate-950/30 p-4 text-sm text-slate-100 placeholder:text-slate-500"
            placeholder="Tulis pengumuman..."
          />
        </div>
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={createBroadcast}
            className="inline-flex items-center justify-center rounded-xl border border-blue-500/40 bg-blue-500/15 px-4 py-2 text-sm font-semibold text-blue-100 hover:bg-blue-500/20"
          >
            Buat Antrian
          </button>
        </div>
      </div>

      <div className="rounded-3xl bg-slate-900/60 p-6 shadow-xl border border-slate-700/50 backdrop-blur-2xl space-y-4">
        <div className="text-sm font-semibold text-slate-100">Riwayat Antrian Broadcast</div>
        <div className="space-y-2">
          {loading ? (
            <div className="text-sm text-slate-300">Memuat...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-slate-300">Belum ada broadcast.</div>
          ) : (
            rows.slice(0, 20).map((b) => (
              <div key={b.id} className="rounded-2xl border border-slate-700/40 bg-slate-950/20 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100">{b.title || "-"}</div>
                    <div className="mt-1 text-sm text-slate-300 whitespace-pre-wrap">{b.message || "-"}</div>
                    <div className="mt-2 text-xs text-slate-400">
                      Target: {b.target.mode === "ALL" ? "ALL" : `SCHOOL: ${b.target.schoolId || "-"}`} ·{" "}
                      {b.createdAt ? new Date(b.createdAt).toLocaleString("id-ID") : "-"} · {b.createdBy || "-"}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === b.id}
                    onClick={() => deleteBroadcast(b.id)}
                    className={`rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-500/15 ${
                      busyId === b.id ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
