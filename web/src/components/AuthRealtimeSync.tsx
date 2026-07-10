"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onValue, ref } from "firebase/database";
import { onAuthStateChanged, signInAnonymously, signOut } from "firebase/auth";
import { edulockAuth, edulockDb } from "@/lib/edulockFirebase";
import { auth as gasAuth } from "@/lib/firebase";
import { buildPortalLoginHref } from "@/lib/portalAccess";
import { useAuthStore } from "@/store/useAuthStore";

function normalize(value: unknown): string {
  return String(value || "").trim();
}

function isGasRealtimePath(path: string): boolean {
  return (
    path.startsWith("/admin") ||
    path.startsWith("/dashboard") ||
    path.startsWith("/super-admin")
  );
}

export function AuthRealtimeSync() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, _hasHydrated, logout, updateUser } = useAuthStore();
  const lastKickedAtRef = useRef<number>(0);
  const gasAnonInFlightRef = useRef(false);
  const gasAnonCooldownUntilRef = useRef<number>(0);
  const gasAnonLastLogAtRef = useRef<number>(0);

  const currentPath = useMemo(() => {
    const p = normalize(pathname);
    return p && p.startsWith("/") ? p : "/admin";
  }, [pathname]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("gasAnonCooldownUntil");
      const value = raw ? Number(raw) : 0;
      if (Number.isFinite(value) && value > gasAnonCooldownUntilRef.current) {
        gasAnonCooldownUntilRef.current = value;
      }
    } catch {}

    const unsub = onAuthStateChanged(gasAuth, (u) => {
      const canUseGasRealtime =
        _hasHydrated &&
        isAuthenticated &&
        !!user &&
        (user.role === "admin" || user.role === "super_admin") &&
        isGasRealtimePath(currentPath);

      if (u && !canUseGasRealtime) {
        signOut(gasAuth).catch(() => {});
        return;
      }

      if (u || !canUseGasRealtime) return;

      const now = Date.now();
      if (gasAnonInFlightRef.current) return;
      if (now < gasAnonCooldownUntilRef.current) return;

      gasAnonInFlightRef.current = true;
      signInAnonymously(gasAuth)
        .catch((e: any) => {
          const code = String(e?.code || "");
          const cooldownMs = code === "auth/too-many-requests" ? 60_000 : 8_000;
          gasAnonCooldownUntilRef.current = Date.now() + cooldownMs;
          try {
            sessionStorage.setItem("gasAnonCooldownUntil", String(gasAnonCooldownUntilRef.current));
          } catch {}

          if (Date.now() - gasAnonLastLogAtRef.current > 10_000) {
            gasAnonLastLogAtRef.current = Date.now();
            console.warn("GAS anonymous auth throttled", code || e);
          }
        })
        .finally(() => {
          gasAnonInFlightRef.current = false;
        });
    });
    return () => unsub();
  }, [_hasHydrated, currentPath, isAuthenticated, user]);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated || !user) return;

    const uid = normalize(user.id);
    const schoolId = normalize(user.schoolId).toLowerCase();
    if (!uid) return;

    const kick = async (reason: "account_inactive" | "school_inactive") => {
      const now = Date.now();
      if (now - lastKickedAtRef.current < 1500) return;
      lastKickedAtRef.current = now;

      try {
        await signOut(edulockAuth);
      } catch {}
      logout();
      const target =
        user.role === "admin" || user.role === "super_admin"
          ? `/admin/login?returnTo=${encodeURIComponent(currentPath)}&reason=${reason}`
          : `${buildPortalLoginHref(currentPath)}${buildPortalLoginHref(currentPath).includes("?") ? "&" : "?"}reason=${reason}`;
      router.replace(target);
    };

    const unsubProfile = onValue(ref(edulockDb, `admin_profiles/${uid}`), (snapshot) => {
      if (!snapshot.exists()) return;
      const data: any = snapshot.val() || {};
      if (data?.isActive === false) {
        void kick("account_inactive");
        return;
      }

      const nextRole = String(data?.role || "") === "super_admin" ? "super_admin" : "admin";
      if (nextRole && nextRole !== user.role) {
        updateUser({ role: nextRole as any });
      }

      const nextSchoolId = normalize(data?.schoolId).toLowerCase();
      const nextSchoolName = normalize(data?.schoolName);
      const nextNpsn = normalize(data?.npsn);
      const patch: any = {};
      if (nextSchoolId && nextSchoolId !== normalize(user.schoolId).toLowerCase()) patch.schoolId = nextSchoolId;
      if (nextSchoolName && nextSchoolName !== normalize(user.schoolName)) patch.schoolName = nextSchoolName;
      if (nextNpsn && nextNpsn !== normalize(user.npsn)) patch.npsn = nextNpsn;
      if (Object.keys(patch).length) updateUser(patch);
    });

    const unsubSchool =
      schoolId
        ? onValue(ref(edulockDb, `schools/${schoolId}`), (snapshot) => {
            if (!snapshot.exists()) return;
            const s: any = snapshot.val() || {};
            if (s?.isActive === false || s?.serviceStatus?.serviceActive === false) {
              void kick("school_inactive");
              return;
            }
            if (user.role === "admin" && s?.adminAccessActive === false) {
              void kick("account_inactive");
              return;
            }
            const nextName = normalize(s?.name);
            const nextNpsn = normalize(s?.npsn);
            const patch: any = {};
            if (nextName && nextName !== normalize(user.schoolName)) patch.schoolName = nextName;
            if (nextNpsn && nextNpsn !== normalize(user.npsn)) patch.npsn = nextNpsn;
            if (Object.keys(patch).length) updateUser(patch);
          })
        : () => {};

    return () => {
      unsubProfile();
      unsubSchool();
    };
  }, [_hasHydrated, currentPath, isAuthenticated, logout, router, updateUser, user]);

  return null;
}
