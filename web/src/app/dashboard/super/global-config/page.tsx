"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { onValue, ref } from "firebase/database";
import { edulockDb } from "@/lib/edulockFirebase";
import { callEduLockSuperApi } from "@/lib/callEduLockSuperApi";

function normalize(value: unknown): string {
  return String(value || "").trim();
}

export default function GasSuperAdminGlobalConfigPage() {
  const [serverValue, setServerValue] = useState<any>(null);
  const [jsonText, setJsonText] = useState<string>("{}");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const dirtyRef = useRef(false);

  const pathLabel = "gas/global_config";

  useEffect(() => {
    setLoading(true);
    setError("");
    const unsub = onValue(
      ref(edulockDb, pathLabel),
      (snap) => {
        const v = snap.val();
        setServerValue(v ?? null);
        if (!dirtyRef.current) {
          const pretty = JSON.stringify(v ?? {}, null, 2);
          setJsonText(pretty);
        }
        setLoading(false);
      },
      (e) => {
        setError(String((e as any)?.message || e || "Gagal memuat konfigurasi global."));
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const summary = useMemo(() => {
    if (!serverValue || typeof serverValue !== "object") return { keys: 0, updatedAt: null as number | null };
    const keys = Object.keys(serverValue).filter((k) => !k.startsWith("_")).length;
    const updatedAt = typeof serverValue?._updatedAt === "number" ? serverValue._updatedAt : null;
    return { keys, updatedAt };
  }, [serverValue]);

  const save = async () => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(jsonText || "{}");
      } catch (e: any) {
        throw new Error(`JSON tidak valid: ${String(e?.message || e)}`);
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Konfigurasi harus berupa object JSON (bukan array / nilai tunggal).");
      }
      await callEduLockSuperApi("POST", {
        action: "save-global-config",
        config: parsed,
      });
      dirtyRef.current = false;
      setStatus("Tersimpan.");
      setTimeout(() => setStatus(""), 2000);
    } catch (e: any) {
      setError(String(e?.message || e || "Gagal menyimpan konfigurasi."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-slate-900/60 p-6 shadow-xl border border-slate-700/50 backdrop-blur-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Konfigurasi Global</h1>
            <p className="mt-1 text-sm text-slate-300">
              Konfigurasi default operasional GAS lintas tenant (siap untuk versioning/rollout).
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
            <div className="text-sm font-semibold text-slate-100">Realtime Global Config</div>
            <div className="mt-1 text-sm text-slate-300">
              Sumber data: <span className="font-semibold text-slate-200">{pathLabel}</span>
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Keys: {summary.keys} · Updated:{" "}
              {summary.updatedAt ? new Date(summary.updatedAt).toLocaleString("id-ID") : "-"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy || loading}
              onClick={save}
              className={`inline-flex items-center justify-center rounded-xl border border-blue-500/40 bg-blue-500/15 px-4 py-2 text-sm font-semibold text-blue-100 hover:bg-blue-500/20 transition ${
                busy || loading ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              Simpan
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}
        {status ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            {status}
          </div>
        ) : null}

        <textarea
          value={jsonText}
          onChange={(e) => {
            dirtyRef.current = true;
            setJsonText(e.target.value);
          }}
          spellCheck={false}
          className="min-h-[420px] w-full rounded-2xl border border-slate-700/50 bg-slate-950/30 p-4 font-mono text-xs text-slate-100 placeholder:text-slate-500"
          placeholder={loading ? "Memuat..." : "{}"}
        />
      </div>
    </div>
  );
}
