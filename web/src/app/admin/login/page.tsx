"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { Eye, EyeOff } from "lucide-react";
import { signInWithEmailAndPassword, updatePassword, type User } from "firebase/auth";
import { edulockAuth } from "@/lib/edulockFirebase";

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeNpsn(value: unknown): string {
  return String(value || "").trim();
}

function withTimeout<T>(task: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([task, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  }) as Promise<T>;
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginContent />
    </Suspense>
  );
}

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const { isAuthenticated, user, _hasHydrated } = useAuthStore();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("admin123");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mustChangeGate, setMustChangeGate] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [pendingSession, setPendingSession] = useState<{
    uid: string;
    name: string;
    email: string;
    role: "admin" | "super_admin";
    schoolId?: string;
    schoolName?: string;
    npsn?: string;
  } | null>(null);

  const getEduLockIdToken = async (preferredUser?: User | null) => {
    const activeUser = preferredUser || edulockAuth.currentUser;
    if (!activeUser) {
      throw new Error("Sesi EduLock tidak aktif. Silakan login ulang.");
    }

    return withTimeout(
      activeUser.getIdToken(),
      5000,
      "Timeout saat mengambil token EduLock. Silakan coba lagi."
    );
  };

  const fetchJsonWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, message?: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } catch (error: any) {
      if (error?.name === "AbortError") {
        throw new Error(message || "Permintaan melebihi batas waktu. Silakan coba lagi.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const callEduLockAuthApi = async (payload: Record<string, any>, withToken = false, preferredUser?: User | null) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (withToken) {
      headers.Authorization = `Bearer ${await getEduLockIdToken(preferredUser)}`;
    }

    const response = await fetchJsonWithTimeout(
      "/api/admin/edulock/auth",
      {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      },
      "Permintaan autentikasi EduLock terlalu lama."
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success === false) {
      throw new Error(String(result?.message || "Permintaan auth EduLock gagal diproses."));
    }

    return result;
  };

  const syncPortalSession = async (name: string, email: string, preferredUser?: User | null) => {
    const response = await fetchJsonWithTimeout(
      "/api/portal/session",
      {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await getEduLockIdToken(preferredUser)}`,
      },
      credentials: "include",
      body: JSON.stringify({
        action: "admin-sync",
        name,
        email,
      }),
      },
      "Sinkronisasi sesi Portal terlalu lama."
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success === false) {
      throw new Error(String(result?.message || "Sinkronisasi sesi portal gagal."));
    }
  };

  const ensurePortalSessionReady = async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await fetchJsonWithTimeout("/api/portal/session", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (response.ok) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error("Sesi Portal admin belum aktif penuh. Silakan coba lagi.");
  };

  const returnTo = useMemo(() => {
    const raw = searchParams?.get("returnTo");
    return raw && raw.startsWith("/") ? raw : "/admin";
  }, [searchParams]);

  const loginTitle = useMemo(() => {
    const dest = String(returnTo || "");
    if (dest.startsWith("/dashboard/super")) return "Login Super Admin";
    return "Login Admin";
  }, [returnTo]);

  const infoMessage = useMemo(() => {
    const reason = String(searchParams?.get("reason") || "");
    if (reason === "account_inactive") return "Akun Anda dinonaktifkan oleh Super Admin. Silakan hubungi admin pusat.";
    if (reason === "school_inactive") return "Sekolah Anda dinonaktifkan oleh Super Admin. Silakan hubungi admin pusat.";
    return "";
  }, [searchParams]);

  useEffect(() => {
    if (!_hasHydrated) return;
    const dest = String(returnTo || "");
    const redirectTarget =
      user?.role === "super_admin" && (dest === "/admin" || dest === "/super-admin" || dest.startsWith("/dashboard"))
        ? "/admin"
        : returnTo;
    const canAutoRedirect =
      isAuthenticated &&
      (dest.startsWith("/dashboard/super")
        ? user?.role === "super_admin"
        : user?.role === "admin" || user?.role === "super_admin");
    if (canAutoRedirect) {
      router.replace(redirectTarget);
    }
  }, [_hasHydrated, isAuthenticated, router, returnTo, user?.role]);

  const handleResetPassword = async () => {
    setError("");
    const raw = String(identifier || "").trim();
    if (!raw) {
      setError("Masukkan NPSN atau email terlebih dahulu.");
      return;
    }

    try {
      if (raw.includes("@")) {
        const targetEmail = normalizeEmail(raw);
        await callEduLockAuthApi({ action: "send-reset-email", email: targetEmail });
        window.alert(`Link reset password telah dikirim ke ${targetEmail}.`);
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
      if (!raw || !password) {
        setError("NPSN/Email dan password wajib diisi.");
        return;
      }

      const isEmailLogin = raw.includes("@");
      const isDefaultPassword = String(password) === "admin123";
      let uid = "";
      let schoolId = "";
      let schoolName = "";
      let npsnValue = "";
      let portalName = "Admin";
      let portalEmail = isEmailLogin ? normalizeEmail(raw) : normalizeNpsn(raw);
      let portalRole: "admin" | "super_admin" = "admin";
      let mustChangePasswordFlag = false;
      let signedInUser: User | null = null;

      try {
        if (isEmailLogin) {
          const emailLower = normalizeEmail(raw);
          portalEmail = emailLower;
          const userCredential = await signInWithEmailAndPassword(edulockAuth, emailLower, password);
          signedInUser = userCredential.user;
          uid = userCredential.user.uid;
          const syncResult = await callEduLockAuthApi({ action: "sync-profile" }, true, userCredential.user);
          const profile = syncResult?.data?.profile || {};
          portalRole = profile?.role === "super_admin" ? "super_admin" : "admin";
          schoolId = String(profile?.schoolId || "");
          schoolName = String(profile?.schoolName || "");
          npsnValue = String(profile?.npsn || "");
          mustChangePasswordFlag = profile?.mustChangePassword === true || isDefaultPassword;
          portalName =
            portalRole === "super_admin"
              ? "Super Admin"
              : schoolName
                ? `Admin ${schoolName}`
                : "Admin";
        } else {
          npsnValue = normalizeNpsn(raw);
          const systemEmail = `${npsnValue}@edulock.local`;

          portalEmail = systemEmail;
          portalName = "Admin Sekolah";
          portalRole = "admin";

          const userCredential = await signInWithEmailAndPassword(edulockAuth, systemEmail, password);
          signedInUser = userCredential.user;
          uid = userCredential.user.uid;
          const syncResult = await callEduLockAuthApi({ action: "sync-profile" }, true, userCredential.user);
          const profile = syncResult?.data?.profile || {};
          schoolId = String(profile?.schoolId || schoolId);
          schoolName = String(profile?.schoolName || schoolName);
          npsnValue = String(profile?.npsn || npsnValue);
          mustChangePasswordFlag = profile?.mustChangePassword === true || isDefaultPassword;
        }
      } catch (err2: any) {
        const code = String(err2?.code || "");
        const isInvalidCredential = code === "auth/invalid-credential";
        const isWrongPassword = code === "auth/wrong-password" || isInvalidCredential;
        const isUserNotFound = code === "auth/user-not-found";

        if (!isEmailLogin && isDefaultPassword) {
          try {
            const npsnLocal = normalizeNpsn(raw);
            const systemEmail = `${npsnLocal}@edulock.local`;
            const bootstrapResult = await callEduLockAuthApi({
              action: "bootstrap-school-admin",
              npsn: npsnLocal,
            });
            if (bootstrapResult?.data?.created || bootstrapResult?.data?.defaultReady) {
              const userCredential = await signInWithEmailAndPassword(edulockAuth, systemEmail, "admin123");
              signedInUser = userCredential.user;
              uid = userCredential.user.uid;
              const syncResult = await callEduLockAuthApi({ action: "sync-profile" }, true, userCredential.user);
              const profile = syncResult?.data?.profile || {};
              mustChangePasswordFlag = true;
              schoolId = String(profile?.schoolId || "");
              schoolName = String(profile?.schoolName || "");
              npsnValue = String(profile?.npsn || npsnLocal);
              portalEmail = systemEmail;
              portalName = schoolName ? `Admin ${schoolName}` : "Admin Sekolah";
            } else {
              setError(
                "Password default admin123 tidak tersedia untuk akun ini karena password sudah pernah diganti. Minta super admin klik Reset Default di halaman Database Super Admin agar akun kembali ke username NPSN dan password admin123."
              );
              return;
            }
          } catch {
            setError("Gagal memverifikasi akun. Coba lagi atau hubungi admin pusat.");
            return;
          }
        }

        if (isUserNotFound) {
          setError("Akun belum dibuat. Login pertama wajib pakai password admin123.");
        } else if (isWrongPassword) {
          setError(
            !isEmailLogin && isDefaultPassword
              ? "Password default admin123 tidak cocok untuk akun ini. Minta super admin klik Reset Default di halaman Database Super Admin."
              : "Password salah."
          );
        } else if (code === "auth/invalid-email") {
          setError("Email belum valid. Hubungi admin pusat.");
        } else {
          setError(`Gagal masuk: ${String(err2?.message || err2)}`);
        }
        return;
      }

      const dest = String(returnTo || "");
      if (dest.startsWith("/dashboard/super") && portalRole !== "super_admin") {
        setError("Akun ini bukan Super Admin.");
        return;
      }

      if (!uid) {
        setError("Gagal memverifikasi sesi login. Silakan coba lagi.");
        return;
      }

      if (mustChangePasswordFlag) {
        setPendingSession({
          uid,
          name: portalName,
          email: portalEmail,
          role: portalRole,
          schoolId: schoolId || undefined,
          schoolName: schoolName || undefined,
          npsn: npsnValue || undefined,
        });
        setMustChangeGate(true);
        setNewPassword("");
        setConfirmPassword("");
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        return;
      }

      login({
        id: uid,
        name: portalName,
        email: portalEmail,
        role: portalRole,
        schoolId: schoolId || undefined,
        schoolName: schoolName || undefined,
        npsn: npsnValue || undefined,
      });
      await syncPortalSession(portalName, portalEmail, signedInUser);
      await ensurePortalSessionReady();

      const finalReturnTo =
        portalRole === "super_admin" && (dest === "/admin" || dest === "/super-admin" || dest.startsWith("/dashboard"))
          ? "/admin"
          : returnTo;
      router.replace(finalReturnTo);
    } catch (err: any) {
      setError(`Terjadi kesalahan: ${String(err?.message || err)}`);
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
    if (!pendingSession?.uid) {
      setError("Sesi tidak valid. Silakan login ulang.");
      setMustChangeGate(false);
      setPendingSession(null);
      return;
    }

    setChangingPassword(true);
    try {
      if (!edulockAuth.currentUser) throw new Error("User tidak terautentikasi.");
      await updatePassword(edulockAuth.currentUser, next);
      await callEduLockAuthApi({ action: "password-changed" }, true, edulockAuth.currentUser);

      login({
        id: pendingSession.uid,
        name: pendingSession.name,
        email: pendingSession.email,
        role: pendingSession.role,
        schoolId: pendingSession.schoolId,
        schoolName: pendingSession.schoolName,
        npsn: pendingSession.npsn,
      });
      await syncPortalSession(pendingSession.name, pendingSession.email, edulockAuth.currentUser);
      await ensurePortalSessionReady();

      const dest = String(returnTo || "");
      const finalReturnTo =
        pendingSession.role === "super_admin" && (dest === "/admin" || dest === "/super-admin" || dest.startsWith("/dashboard"))
          ? "/admin"
          : returnTo;
      router.replace(finalReturnTo);

      setMustChangeGate(false);
      setPendingSession(null);
      setNewPassword("");
      setConfirmPassword("");
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (e: any) {
      setError(`Gagal ubah password: ${String(e?.message || e)}`);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 shadow-xl backdrop-blur">
          <div className="flex flex-col items-center">
            <Image
              src="/PortalKita.png"
              alt="Logo PortalKita"
              width={120}
              height={120}
              className="mb-4 object-contain"
              priority
            />
            <p className="text-center text-sm font-semibold text-slate-200">
              SELAMAT DATANG DI PORTALKITA
            </p>
            <h1 className="text-center text-2xl font-bold tracking-tight text-white">{loginTitle}</h1>
          </div>

          {error && (
            <div className="mt-6 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {infoMessage && !error && (
            <div className="mt-6 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
              {infoMessage}
            </div>
          )}

          {mustChangeGate ? (
            <form onSubmit={handleChangePassword} className="mt-6 space-y-4">
              <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                Demi keamanan, Anda wajib mengganti password pada login pertama.
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200">Password Baru</label>
                <div className="relative mt-2">
                  <input
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={changingPassword}
                    type={showNewPassword ? "text" : "password"}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-3 pr-12 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Minimal 6 karakter"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-200 hover:text-white disabled:opacity-60"
                    disabled={changingPassword}
                    aria-label={showNewPassword ? "Sembunyikan password" : "Tampilkan password"}
                    title={showNewPassword ? "Sembunyikan" : "Tampilkan"}
                  >
                    {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200">Konfirmasi Password Baru</label>
                <div className="relative mt-2">
                  <input
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={changingPassword}
                    type={showConfirmPassword ? "text" : "password"}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-3 pr-12 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ulangi password baru"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-200 hover:text-white disabled:opacity-60"
                    disabled={changingPassword}
                    aria-label={showConfirmPassword ? "Sembunyikan password" : "Tampilkan password"}
                    title={showConfirmPassword ? "Sembunyikan" : "Tampilkan"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={changingPassword}
                className="mt-2 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {changingPassword ? "Menyimpan..." : "Simpan Password & Lanjutkan"}
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200">NPSN Admin / Email Super Admin</label>
                  <input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    disabled={loading}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Contoh: 202XXXXXX atau superadmin@email.com"
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200">Password</label>
                  <div className="relative mt-2">
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      type={showPassword ? "text" : "password"}
                      className="w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-3 pr-12 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="admin123"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-200 hover:text-white disabled:opacity-60"
                      disabled={loading}
                      aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                      title={showPassword ? "Sembunyikan" : "Tampilkan"}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Memproses..." : "Masuk"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={loading}
                  className="text-sm font-semibold text-slate-200 hover:text-white disabled:opacity-60"
                >
                  Lupa Password?
                </button>
              </div>

              <p className="mt-6 text-center text-xs text-slate-400">
                Admin sekolah: username NPSN, password awal admin123, lalu wajib ganti password saat login pertama.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
