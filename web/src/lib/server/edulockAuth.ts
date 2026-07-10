import { FIREBASE_BOUNDARY } from "@/lib/firebaseProjectBoundary";
import { getEduLockAdminDb } from "@/lib/server/firebaseAdmin";
import { getPortalSessionFromRequest } from "@/lib/server/portalSession";

type IdentityToolkitLookupResponse = {
  users?: Array<{
    localId?: string;
    email?: string;
  }>;
};

export type ServerEduLockProfile = {
  uid: string;
  email: string;
  role: "super_admin" | "admin";
  isActive: boolean;
  schoolId: string;
  schoolName: string;
  npsn?: string;
};

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeRole(value: unknown): "super_admin" | "admin" {
  return String(value || "") === "super_admin" ? "super_admin" : "admin";
}

async function lookupUserByIdToken(idToken: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_BOUNDARY.edulock.apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Token EduLock tidak valid atau sudah kedaluwarsa.");
  }

  const data = (await response.json()) as IdentityToolkitLookupResponse;
  const user = data.users?.[0];
  const uid = normalizeText(user?.localId);
  if (!uid) {
    throw new Error("UID pengguna EduLock tidak ditemukan.");
  }

  return {
    uid,
    email: normalizeText(user?.email).toLowerCase(),
  };
}

export async function requireEduLockAdminProfile(authorizationHeader?: string | null): Promise<ServerEduLockProfile> {
  const token = String(authorizationHeader || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    const portalSession = getPortalSessionFromRequest();
    const portalUser = portalSession?.user;
    if (portalUser && (portalUser.role === "admin" || portalUser.role === "super_admin")) {
      const profile: ServerEduLockProfile = {
        uid: normalizeText(portalUser.id),
        email: normalizeText(portalUser.email).toLowerCase(),
        role: portalUser.role === "super_admin" ? "super_admin" : "admin",
        isActive: true,
        schoolId: normalizeText(portalUser.schoolId),
        schoolName: normalizeText(portalUser.schoolName),
        npsn: normalizeText(portalUser.npsn) || undefined,
      };

      if (profile.role === "admin" && !profile.schoolId) {
        throw new Error("Akun admin sekolah tidak memiliki schoolId yang valid.");
      }

      return profile;
    }

    throw new Error("Token otorisasi EduLock wajib dikirim.");
  }

  const identity = await lookupUserByIdToken(token);
  const edulockDb = getEduLockAdminDb();
  const snapshot = await edulockDb.ref(`admin_profiles/${identity.uid}`).get();

  if (!snapshot.exists()) {
    throw new Error("Profil admin EduLock tidak ditemukan.");
  }

  const raw = snapshot.val() || {};
  const profile: ServerEduLockProfile = {
    uid: normalizeText(raw.uid || identity.uid),
    email: normalizeText(raw.email || identity.email).toLowerCase(),
    role: normalizeRole(raw.role),
    isActive: raw.isActive !== false,
    schoolId: normalizeText(raw.schoolId),
    schoolName: normalizeText(raw.schoolName),
    npsn: normalizeText(raw.npsn) || undefined,
  };

  if (!profile.isActive) {
    throw new Error("Akun admin EduLock sedang nonaktif.");
  }

  if (profile.role === "admin" && !profile.schoolId) {
    throw new Error("Akun admin sekolah tidak memiliki schoolId yang valid.");
  }

  return profile;
}
