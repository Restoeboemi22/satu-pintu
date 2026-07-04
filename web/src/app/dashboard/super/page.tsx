"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { edulockDb } from "@/lib/edulockFirebase";
import { useEduLockAuth } from "@/lib/useEduLockAuth";

export default function GaspaSuperAdminPage() {
  const { isLoading: isEduLockAuthLoading } = useEduLockAuth();
  const [tenantsTotal, setTenantsTotal] = useState(0);
  const [tenantsActive, setTenantsActive] = useState(0);
  const [supportOpen, setSupportOpen] = useState(0);
  const [jobsQueued, setJobsQueued] = useState(0);

  useEffect(() => {
    if (isEduLockAuthLoading) return;
    const unsubSchools = onValue(ref(edulockDb, "schools"), (snap) => {
      const data = snap.val();
      if (!data || typeof data !== "object") {
        setTenantsTotal(0);
        setTenantsActive(0);
        return;
      }
      const list = Object.values(data) as any[];
      setTenantsTotal(list.length);
      setTenantsActive(list.filter((v) => (v as any)?.isActive !== false).length);
    });

    const unsubSupport = onValue(ref(edulockDb, "gas/support_requests"), (snap) => {
      const data = snap.val();
      if (!data || typeof data !== "object") {
        setSupportOpen(0);
        return;
      }
      const list = Object.values(data) as any[];
      setSupportOpen(list.filter((v) => String((v as any)?.status || "OPEN") === "OPEN").length);
    });

    const unsubJobs = onValue(ref(edulockDb, "gas/sync_jobs"), (snap) => {
      const data = snap.val();
      if (!data || typeof data !== "object") {
        setJobsQueued(0);
        return;
      }
      const list = Object.values(data) as any[];
      setJobsQueued(list.filter((v) => String((v as any)?.status || "QUEUED") === "QUEUED").length);
    });

    return () => {
      unsubSchools();
      unsubSupport();
      unsubJobs();
    };
  }, [isEduLockAuthLoading]);

  const items = useMemo(
    () => [
      {
        href: "/dashboard/super/tenants",
        title: "Sekolah & Tenant",
        desc: "Aktif/nonaktif tenant, status integrasi, metadata, kontrol global per sekolah.",
      },
      {
        href: "/dashboard/super/global-config",
        title: "Konfigurasi Global",
        desc: "Kebijakan default GAS lintas tenant (siap untuk versioning/rollout).",
      },
      {
        href: "/dashboard/super/sync-jobs",
        title: "Sync Jobs",
        desc: "Pantau dan jalankan job sinkronisasi (master data/attendance/users).",
      },
      {
        href: "/dashboard/super/broadcast",
        title: "Broadcast Global",
        desc: "Kirim pengumuman lintas sekolah (segmentasi, metrik delivery).",
      },
      {
        href: "/dashboard/super/support",
        title: "Support Tools",
        desc: "Operasional bantuan: reset akses, rerun sync, tools support (butuh audit).",
      },
      {
        href: "/dashboard/super/audit",
        title: "Audit & Compliance",
        desc: "Jejak aksi penting untuk modul GAS (subset audit prefix gas.*).",
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-slate-900/60 p-6 shadow-xl border border-slate-700/50 backdrop-blur-2xl">
        <h1 className="text-2xl font-bold text-slate-100">Dashboard Overview</h1>
        <p className="mt-1 text-sm text-slate-300">
          Control plane lintas sekolah untuk modul GAS (tenant, konfigurasi global, monitoring, broadcast, audit).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-3xl bg-slate-900/60 p-5 shadow-xl border border-slate-700/50 backdrop-blur-2xl">
          <div className="text-xs font-semibold tracking-widest text-slate-400">TENANTS</div>
          <div className="mt-1 text-2xl font-bold text-slate-100">{tenantsTotal}</div>
          <div className="mt-1 text-sm text-slate-300">Total sekolah</div>
        </div>
        <div className="rounded-3xl bg-slate-900/60 p-5 shadow-xl border border-slate-700/50 backdrop-blur-2xl">
          <div className="text-xs font-semibold tracking-widest text-slate-400">AKTIF</div>
          <div className="mt-1 text-2xl font-bold text-slate-100">{tenantsActive}</div>
          <div className="mt-1 text-sm text-slate-300">Sekolah aktif</div>
        </div>
        <div className="rounded-3xl bg-slate-900/60 p-5 shadow-xl border border-slate-700/50 backdrop-blur-2xl">
          <div className="text-xs font-semibold tracking-widest text-slate-400">SYNC QUEUED</div>
          <div className="mt-1 text-2xl font-bold text-slate-100">{jobsQueued}</div>
          <div className="mt-1 text-sm text-slate-300">Menunggu</div>
        </div>
        <div className="rounded-3xl bg-slate-900/60 p-5 shadow-xl border border-slate-700/50 backdrop-blur-2xl">
          <div className="text-xs font-semibold tracking-widest text-slate-400">SUPPORT OPEN</div>
          <div className="mt-1 text-2xl font-bold text-slate-100">{supportOpen}</div>
          <div className="mt-1 text-sm text-slate-300">Request terbuka</div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="rounded-3xl bg-slate-900/50 p-6 shadow-xl border border-slate-700/50 backdrop-blur-2xl hover:border-blue-500/40 transition-colors"
          >
            <div className="text-sm font-semibold text-slate-100">{it.title}</div>
            <div className="mt-1 text-sm text-slate-300">{it.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
