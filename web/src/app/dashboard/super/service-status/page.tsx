"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { edulockDb } from "@/lib/edulockFirebase";
import { callEduLockSuperApi } from "@/lib/callEduLockSuperApi";

type PaymentStatus = "PAID" | "UNPAID";
type FilterMode = "ALL" | "PAID" | "UNPAID" | "ACTIVE" | "INACTIVE";

type SchoolRow = {
  schoolId: string;
  name: string;
  district: string;
  npsn: string;
  isActive: boolean;
  paymentStatus: PaymentStatus;
  confirmedAt: number | null;
  note: string;
};

function normalize(value: unknown): string {
  return String(value || "").trim();
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  return normalize(value).toUpperCase() === "PAID" ? "PAID" : "UNPAID";
}

function formatDate(ts?: number | null): string {
  if (!ts || typeof ts !== "number") return "-";
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function paymentBadgeClass(status: PaymentStatus) {
  return status === "PAID"
    ? "border-emerald-400/20 bg-emerald-500/15 text-emerald-100"
    : "border-amber-400/20 bg-amber-500/15 text-amber-100";
}

function serviceBadgeClass(active: boolean) {
  return active
    ? "border-cyan-400/20 bg-cyan-500/15 text-cyan-100"
    : "border-rose-400/20 bg-rose-500/15 text-rose-100";
}

export default function ServiceStatusPage() {
  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<{ type: "" | "success" | "error"; text: string }>({ type: "", text: "" });
  const [filterMode, setFilterMode] = useState<FilterMode>("ALL");
  const [search, setSearch] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState("");

  useEffect(() => {
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

        const nextRows = Object.entries<any>(data)
          .map(([key, value]) => {
            const serviceStatus = value?.serviceStatus && typeof value.serviceStatus === "object" ? value.serviceStatus : {};
            return {
              schoolId: normalize(value?.schoolId || key).toLowerCase(),
              name: normalize(value?.name),
              district: normalize(value?.district),
              npsn: normalize(value?.npsn),
              isActive: value?.isActive !== false,
              paymentStatus: normalizePaymentStatus(serviceStatus?.paymentStatus),
              confirmedAt: typeof serviceStatus?.confirmedAt === "number" ? serviceStatus.confirmedAt : null,
              note: normalize(serviceStatus?.note),
            } satisfies SchoolRow;
          })
          .sort((a, b) => String(a.name || a.schoolId).localeCompare(String(b.name || b.schoolId)));

        setRows(nextRows);
        setNoteDrafts((prev) => {
          const nextDrafts = { ...prev };
          for (const row of nextRows) {
            if (!(row.schoolId in nextDrafts)) {
              nextDrafts[row.schoolId] = row.note;
            }
          }
          return nextDrafts;
        });
        setLoading(false);
      },
      (e) => {
        setError(String((e as any)?.message || e || "Gagal memuat status layanan sekolah."));
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const paid = rows.filter((row) => row.paymentStatus === "PAID").length;
    const unpaid = total - paid;
    const active = rows.filter((row) => row.isActive).length;
    const inactive = total - active;
    return { total, paid, unpaid, active, inactive };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filterMode === "PAID" && row.paymentStatus !== "PAID") return false;
      if (filterMode === "UNPAID" && row.paymentStatus !== "UNPAID") return false;
      if (filterMode === "ACTIVE" && !row.isActive) return false;
      if (filterMode === "INACTIVE" && row.isActive) return false;
      if (!keyword) return true;
      return [row.name, row.schoolId, row.npsn, row.district, row.note].some((value) =>
        String(value || "").toLowerCase().includes(keyword)
      );
    });
  }, [filterMode, rows, search]);

  const setFlash = (type: "" | "success" | "error", text: string) => {
    setStatus({ type, text });
    if (!text) return;
    window.setTimeout(() => {
      setStatus((current) => (current.text === text ? { type: "", text: "" } : current));
    }, 2500);
  };

  const handlePaymentToggle = async (row: SchoolRow) => {
    const nextStatus: PaymentStatus = row.paymentStatus === "PAID" ? "UNPAID" : "PAID";
    const busy = `payment:${row.schoolId}`;
    setBusyKey(busy);
    try {
      await callEduLockSuperApi("POST", {
        action: "save-school-service-status",
        schoolId: row.schoolId,
        serviceStatus: {
          paymentStatus: nextStatus,
          confirmedAt: Date.now(),
        },
      });
      setFlash("success", `Status pembayaran ${row.name || row.schoolId} diperbarui.`);
    } catch (e: any) {
      setFlash("error", `Gagal menyimpan pembayaran: ${String(e?.message || e)}`);
    } finally {
      setBusyKey("");
    }
  };

  const handleServiceToggle = async (row: SchoolRow) => {
    const busy = `service:${row.schoolId}`;
    setBusyKey(busy);
    try {
      await callEduLockSuperApi("PUT", {
        action: "toggle-school-active",
        schoolId: row.schoolId,
        nextActive: !row.isActive,
      });
      setFlash("success", `Status layanan ${row.name || row.schoolId} diperbarui.`);
    } catch (e: any) {
      setFlash("error", `Gagal mengubah layanan: ${String(e?.message || e)}`);
    } finally {
      setBusyKey("");
    }
  };

  const handleSaveNote = async (row: SchoolRow) => {
    const nextNote = normalize(noteDrafts[row.schoolId]);
    const busy = `note:${row.schoolId}`;
    setBusyKey(busy);
    try {
      await callEduLockSuperApi("POST", {
        action: "save-school-service-status",
        schoolId: row.schoolId,
        serviceStatus: {
          note: nextNote,
        },
      });
      setFlash("success", `Catatan layanan ${row.name || row.schoolId} tersimpan.`);
    } catch (e: any) {
      setFlash("error", `Gagal menyimpan catatan: ${String(e?.message || e)}`);
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-xl backdrop-blur-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Status Layanan Sekolah</h1>
            <p className="mt-1 text-sm text-slate-300">
              Monitoring sederhana untuk melihat status pembayaran sekolah dan kontrol aktif/nonaktif layanan.
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-900/60"
          >
            Kembali
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "TOTAL", value: stats.total, caption: "Semua sekolah" },
          { label: "SUDAH MEMBAYAR", value: stats.paid, caption: "Tercatat membayar", valueClass: "text-emerald-300" },
          { label: "BELUM MEMBAYAR", value: stats.unpaid, caption: "Perlu tindak lanjut", valueClass: "text-amber-300" },
          { label: "LAYANAN AKTIF", value: stats.active, caption: "Bisa digunakan", valueClass: "text-cyan-300" },
          { label: "LAYANAN NONAKTIF", value: stats.inactive, caption: "Sedang ditutup", valueClass: "text-rose-300" },
        ].map((item) => (
          <div key={item.label} className="rounded-3xl border border-slate-700/50 bg-slate-900/60 p-5 shadow-xl backdrop-blur-2xl">
            <div className="text-xs font-semibold tracking-widest text-slate-400">{item.label}</div>
            <div className={`mt-1 text-3xl font-bold text-slate-100 ${item.valueClass || ""}`}>{item.value}</div>
            <div className="mt-1 text-sm text-slate-300">{item.caption}</div>
          </div>
        ))}
      </div>

      {error ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}
      {status.text ? (
        <div
          className={`rounded-2xl border p-4 text-sm ${
            status.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : "border-red-500/30 bg-red-500/10 text-red-100"
          }`}
        >
          {status.text}
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-xl backdrop-blur-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-100">Monitoring Status Pembayaran & Layanan</div>
            <div className="mt-1 text-sm text-slate-300">
              Sumber data: `schools` dengan status layanan tersimpan di dalam data sekolah.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterMode}
              onChange={(event) => setFilterMode(event.target.value as FilterMode)}
              className="rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
            >
              <option value="ALL">Semua</option>
              <option value="PAID">Sudah Membayar</option>
              <option value="UNPAID">Belum Membayar</option>
              <option value="ACTIVE">Layanan Aktif</option>
              <option value="INACTIVE">Layanan Nonaktif</option>
            </select>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari schoolId / nama sekolah / catatan..."
              className="w-72 rounded-xl border border-slate-700/50 bg-slate-950/40 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                <th className="px-4 py-3">Sekolah</th>
                <th className="px-4 py-3">NPSN / Kecamatan</th>
                <th className="px-4 py-3">Pembayaran</th>
                <th className="px-4 py-3">Konfirmasi Terakhir</th>
                <th className="px-4 py-3">Catatan</th>
                <th className="px-4 py-3">Layanan</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-300">
                    Memuat...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-300">
                    Tidak ada sekolah yang cocok dengan filter saat ini.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.schoolId} className="align-top hover:bg-white/5">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-white">{row.name || "-"}</div>
                      <div className="mt-1 text-xs text-slate-400">{row.schoolId}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-slate-100">{row.npsn || "-"}</div>
                      <div className="mt-1 text-xs text-slate-400">{row.district || "-"}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${paymentBadgeClass(row.paymentStatus)}`}>
                        {row.paymentStatus === "PAID" ? "Sudah Membayar" : "Belum Membayar"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-300">{formatDate(row.confirmedAt)}</td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <input
                          value={noteDrafts[row.schoolId] ?? row.note}
                          onChange={(event) =>
                            setNoteDrafts((prev) => ({
                              ...prev,
                              [row.schoolId]: event.target.value,
                            }))
                          }
                          placeholder="Catatan singkat..."
                          className="w-44 rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveNote(row)}
                          disabled={busyKey === `note:${row.schoolId}`}
                          className="rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-900/70 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busyKey === `note:${row.schoolId}` ? "Menyimpan..." : "Simpan Catatan"}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${serviceBadgeClass(row.isActive)}`}>
                        {row.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-end gap-2">
                        <button
                          type="button"
                          onClick={() => handlePaymentToggle(row)}
                          disabled={busyKey === `payment:${row.schoolId}`}
                          className="rounded-xl border border-amber-400/25 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busyKey === `payment:${row.schoolId}`
                            ? "Menyimpan..."
                            : row.paymentStatus === "PAID"
                              ? "Tandai Belum Membayar"
                              : "Tandai Sudah Membayar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleServiceToggle(row)}
                          disabled={busyKey === `service:${row.schoolId}`}
                          className={`rounded-xl border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                            row.isActive
                              ? "border-rose-400/25 bg-rose-500/15 text-rose-100 hover:bg-rose-500/20"
                              : "border-emerald-400/25 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/20"
                          }`}
                        >
                          {busyKey === `service:${row.schoolId}` ? "Menyimpan..." : row.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </div>
                    </td>
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
