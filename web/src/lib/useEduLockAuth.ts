import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { onValue, ref } from "firebase/database";
import { edulockAuth, edulockDb } from "@/lib/edulockFirebase";

export type EduLockRole = "super_admin" | "admin";

export interface EduLockAdminProfile {
  uid: string;
  email: string;
  role: EduLockRole;
  isActive: boolean;
  schoolId: string;
  schoolName: string;
  npsn?: string;
  mustChangePassword?: boolean;
  passwordChangedAt?: number | null;
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number;
}

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function toRole(value: unknown): EduLockRole {
  return String(value || "") === "super_admin" ? "super_admin" : "admin";
}

async function loadOrCreateProfile(user: User): Promise<EduLockAdminProfile> {
  const idToken = await user.getIdToken();
  const response = await fetch("/api/admin/edulock/auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ action: "sync-profile" }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.success === false) {
    await signOut(edulockAuth);
    throw new Error(String(result?.message || "Gagal sinkronisasi profil EduLock."));
  }

  const raw = result?.data?.profile || {};
  return {
    uid: normalizeText(raw.uid || user.uid),
    email: normalizeEmail(raw.email || user.email || ""),
    role: toRole(raw.role),
    isActive: raw.isActive !== false,
    schoolId: normalizeText(raw.schoolId),
    schoolName: normalizeText(raw.schoolName),
    npsn: normalizeText(raw.npsn) || undefined,
    mustChangePassword: raw.mustChangePassword === true,
    passwordChangedAt: typeof raw.passwordChangedAt === "number" ? raw.passwordChangedAt : null,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
    lastLoginAt: typeof raw.lastLoginAt === "number" ? raw.lastLoginAt : Date.now(),
  };
}

export function useEduLockAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<EduLockAdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const unsub = onAuthStateChanged(edulockAuth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setError("");
      if (!user) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const p = await loadOrCreateProfile(user);
        if (!cancelled) setProfile(p);
      } catch (e: any) {
        const msg = String(e?.message || e || "Gagal memuat profil EduLock.");
        if (!cancelled) {
          setProfile(null);
          setError(msg);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const profileRef = ref(edulockDb, `admin_profiles/${uid}`);
    const unsub = onValue(profileRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data: any = snapshot.val() || {};
      if (data?.isActive === false) {
        void signOut(edulockAuth).catch(() => {});
        setProfile(null);
        setError("Akun admin dinonaktifkan. Silakan hubungi super admin.");
        return;
      }
      setProfile((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          role: toRole(data?.role),
          isActive: data?.isActive !== false,
          schoolId: data?.schoolId ? String(data.schoolId) : prev.schoolId,
          schoolName: data?.schoolName ? String(data.schoolName) : prev.schoolName,
          npsn: data?.npsn ? String(data.npsn) : prev.npsn,
          mustChangePassword: data?.mustChangePassword === true,
        };
      });
    });
    return () => unsub();
  }, [user]);

  const role: EduLockRole | null = useMemo(() => {
    if (!profile) return null;
    return profile.role === "super_admin" ? "super_admin" : "admin";
  }, [profile]);

  const logout = async () => {
    await signOut(edulockAuth);
  };

  return { user, profile, role, isLoading, error, logout };
}
