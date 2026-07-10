"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, signInWithEmailAndPassword, updatePassword } from "firebase/auth";
import { get, ref } from "firebase/database";
import { edulockAuth, edulockDb } from "@/lib/edulockFirebase";
import { useAuthStore } from "@/store/useAuthStore";

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeNpsn(value: unknown): string {
  return String(value || "").trim();
}

function isSchoolAdminAccessActive(school: any): boolean {
  return school?.adminAccessActive !== false;
}

function EduLockLoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: gaspaUser, isAuthenticated: gaspaAuthenticated, _hasHydrated: gaspaHydrated } = useAuthStore();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mustChangeGate, setMustChangeGate] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [pendingUid, setPendingUid] = useState<string>("");
  const autoTriedRef = useRef(false);

  const callEduLockAuthApi = async (payload: Record<string, any>, withToken = false) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (withToken) {
      const currentUser = edulockAuth.currentUser;
      if (!currentUser) {
        throw new Error("Sesi EduLock tidak aktif. Silakan login ulang.");
      }
      headers.Authorization = `Bearer ${await currentUser.getIdToken()}`;
    }

    const response = await fetch("/api/admin/edulock/auth", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success === false) {
      throw new Error(String(result?.message || "Permintaan auth EduLock gagal diproses."));
    }

    return result;
  };

  const isEmailLogin = useMemo(() => identifier.trim().includes("@"), [identifier]);
  const gaspaNpsn = useMemo(() => normalizeNpsn(gaspaUser?.npsn || ""), [gaspaUser?.npsn]);
  const safeReturnTo = useMemo(() => {
    const raw = String(searchParams?.get("returnTo") || "").trim();
    return raw.startsWith("/edulock") ? raw : "/edulock";
  }, [searchParams]);
  const shouldAutoLogin = useMemo(() => {
    if (!gaspaHydrated) return false;
    if (!gaspaAuthenticated) return false;
    if (gaspaUser?.role !== "admin" && gaspaUser?.role !== "super_admin") return false;
    return true;
  }, [gaspaAuthenticated, gaspaHydrated, gaspaUser?.role]);

  useEffect(() => {
    const unsub = onAuthStateChanged(edulockAuth, (u) => {
      if (u) {
        router.replace(safeReturnTo);
      }
    });
    return () => unsub();
  }, [router, safeReturnTo]);

  useEffect(() => {
    if (!shouldAutoLogin) return;
    if (edulockAuth.currentUser) return;
    if (autoTriedRef.current) return;
    autoTriedRef.current = true;

    void (async () => {
      setError("");
      if (!gaspaNpsn) return;

      setIdentifier(gaspaNpsn);

      setLoading(true);
      try {
        const systemEmail = `${String(gaspaNpsn)}@edulock.local`;
        try {
          setPassword("admin123");
          await signInWithEmailAndPassword(edulockAuth, systemEmail, "admin123");
          await callEduLockAuthApi({ action: "sync-profile" }, true).catch(() => {});
          router.replace(safeReturnTo);
          return;
        } catch (eTry: any) {
          const codeTry = String(eTry?.code || "");
          const isWrong = codeTry === "auth/wrong-password" || codeTry === "auth/invalid-credential";
          const isUserNotFound = codeTry === "auth/user-not-found";
          if (!isWrong && !isUserNotFound) throw eTry;
        }

        setPassword("");
        setError("Login otomatis default EduLock tidak berlaku lagi. Silakan login manual memakai NPSN dan password terbaru.");
      } catch (err: any) {
        const code = String(err?.code || "");
        const message = String(err?.message || err);
        setError(`Login otomatis EduLock gagal (${code || "unknown"}). ${message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [gaspaNpsn, router, shouldAutoLogin]);

  const handleResetPassword = async () => {
    setError("");
    const raw = String(identifier || "").trim();
    if (!raw) {
      setError("Masukkan NPSN atau email terlebih dahulu untuk mereset password.");
      return;
    }

    try {
      if (raw.includes("@")) {
        const targetEmail = normalizeEmail(raw);
        await callEduLockAuthApi({ action: "send-reset-email", email: targetEmail });
        window.alert(`Link reset password telah dikirim ke ${targetEmail}.`);
        return;
      }

      const npsn = normalizeNpsn(raw);
      const schoolIdSnap = await get(ref(edulockDb, `npsn_index/${npsn}`));
      const schoolId = schoolIdSnap.exists() ? String(schoolIdSnap.val() || "") : "";
      if (!schoolId) {
        setError("NPSN tidak ditemukan. Hubungi super admin.");
        return;
      }

      setError(
        "Reset password admin sekolah dilakukan oleh super admin dari halaman Database Super Admin. Username tetap NPSN sekolah dan password default akan dikembalikan ke admin123."
      );
    } catch (e: any) {
      setError(`Gagal mengirim reset password: ${String(e?.message || e)}`);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const raw = String(identifier || "").trim();
      if (!raw) {
        setError("Masukkan NPSN atau email.");
        return;
      }

      if (raw.includes("@")) {
        const emailLower = normalizeEmail(raw);
        await signInWithEmailAndPassword(edulockAuth, emailLower, password);
        const syncResult = await callEduLockAuthApi({ action: "sync-profile" }, true);
        const profile = syncResult?.data?.profile || {};
        const mustChange = profile?.mustChangePassword === true || String(password) === "admin123";
        const uid = String(profile?.uid || edulockAuth.currentUser?.uid || "");
        if (mustChange) {
          setPendingUid(uid);
          setMustChangeGate(true);
          setNewPassword("");
          setConfirmPassword("");
          return;
        }
        router.push(safeReturnTo);
        return;
      }

      const npsn = normalizeNpsn(raw);
      const systemEmail = `${String(npsn)}@edulock.local`;
      const isDefaultPassword = String(password) === "admin123";

      try {
        await signInWithEmailAndPassword(edulockAuth, systemEmail, password);
        const syncResult = await callEduLockAuthApi({ action: "sync-profile" }, true);
        const profile = syncResult?.data?.profile || {};
        const mustChange = profile?.mustChangePassword === true || isDefaultPassword;
        const uid = String(profile?.uid || edulockAuth.currentUser?.uid || "");
        if (mustChange) {
          setPendingUid(uid);
          setMustChangeGate(true);
          setNewPassword("");
          setConfirmPassword("");
          return;
        }
        router.push(safeReturnTo);
        return;
      } catch (err2: any) {
        const code = String(err2?.code || "");
        const isUserNotFound = code === "auth/user-not-found";

        if (isUserNotFound && isDefaultPassword) {
          try {
            const bootstrapResult = await callEduLockAuthApi({
              action: "bootstrap-school-admin",
              npsn,
            });
            if (bootstrapResult?.data?.created || bootstrapResult?.data?.defaultReady) {
              await signInWithEmailAndPassword(edulockAuth, systemEmail, "admin123");
              const syncResult = await callEduLockAuthApi({ action: "sync-profile" }, true);
              const profile = syncResult?.data?.profile || {};
              setPendingUid(String(profile?.uid || edulockAuth.currentUser?.uid || ""));
              setMustChangeGate(true);
              setNewPassword("");
              setConfirmPassword("");
              return;
            }
          } catch {
            setError("Gagal memverifikasi akun sekolah. Coba lagi atau hubungi super admin.");
            return;
          }
        }

        if (isUserNotFound) {
          setError("Akun admin sekolah belum dibuat. Gunakan password admin123 pada login pertama atau hubungi super admin.");
        } else if (code === "auth/invalid-email") {
          setError("Username NPSN tidak valid. Hubungi super admin.");
        } else if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
          setError(
            isDefaultPassword
              ? "Password default admin123 tidak cocok untuk akun ini. Minta super admin klik Reset Default di halaman Database Super Admin."
              : "Password salah."
          );
        } else {
          setError(`Gagal masuk: ${String(err2?.message || err2)}`);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const next = String(newPassword || "");
    const confirm = String(confirmPassword || "");
    if (next.length < 6) {
      setError("Password baru minimal 6 karakter.");
      return;
    }
    if (next === "admin123") {
      setError("Password baru tidak boleh sama dengan admin123.");
      return;
    }
    if (next !== confirm) {
      setError("Konfirmasi password tidak sama.");
      return;
    }
    if (!pendingUid) {
      setError("Sesi tidak valid. Silakan login ulang.");
      setMustChangeGate(false);
      return;
    }

    setChangingPassword(true);
    try {
      if (!edulockAuth.currentUser) throw new Error("User tidak terautentikasi.");
      await updatePassword(edulockAuth.currentUser, next);
      await callEduLockAuthApi({ action: "password-changed" }, true);
      setMustChangeGate(false);
      setPendingUid("");
      setNewPassword("");
      setConfirmPassword("");
      router.push(safeReturnTo);
    } catch (e: any) {
      setError(`Gagal ubah password: ${String(e?.message || e)}`);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="glass-effect-dark-card rounded-3xl p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/20 ring-1 ring-indigo-400/25">
            <span className="text-lg font-black text-indigo-200">E</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">EduLock</h1>
            <p className="text-sm text-slate-400">Dashboard Admin & Super Admin</p>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {mustChangeGate ? (
          <form onSubmit={handleChangePassword} className="mt-6 space-y-4">
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-100">
              Demi keamanan, Anda wajib mengganti password pada login pertama.
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200">Password Baru</label>
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={changingPassword}
                type="password"
                className="mt-2 w-full rounded-2xl border border-slate-700/50 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Minimal 6 karakter"
                autoComplete="new-password"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200">Konfirmasi Password Baru</label>
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={changingPassword}
                type="password"
                className="mt-2 w-full rounded-2xl border border-slate-700/50 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ulangi password baru"
                autoComplete="new-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={changingPassword}
              className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {changingPassword ? "Menyimpan..." : "Simpan Password & Lanjutkan"}
            </button>
          </form>
        ) : (
          <>
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-200">NPSN Admin / Email Super Admin</label>
                <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loading}
                  className="mt-2 w-full rounded-2xl border border-slate-700/50 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="NPSN sekolah atau email super admin"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-200">Password</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  type="password"
                  className="mt-2 w-full rounded-2xl border border-slate-700/50 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={isEmailLogin ? "Password email super admin" : "admin123 (login pertama) / password Anda"}
                  autoComplete="current-password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? "Memproses..." : "Masuk"}
              </button>
            </form>

            <button
              type="button"
              onClick={handleResetPassword}
              className="mt-3 w-full rounded-2xl border border-slate-700/50 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-white/10"
            >
              Lupa Password?
            </button>

            <div className="mt-4 text-center text-xs text-slate-400">
              Login admin sekolah menggunakan username NPSN dan password awal admin123.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function EduLockLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md">
          <div className="glass-effect-dark-card rounded-3xl p-8 text-sm text-slate-200">Menyiapkan login EduLock...</div>
        </div>
      }
    >
      <EduLockLoginPageInner />
    </Suspense>
  );
}
