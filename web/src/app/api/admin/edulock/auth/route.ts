import { NextRequest, NextResponse } from "next/server";
import { FIREBASE_BOUNDARY } from "@/lib/firebaseProjectBoundary";
import { getEduLockAdminAuth, getEduLockAdminDb } from "@/lib/server/firebaseAdmin";
import { writeEduLockAuditEvent } from "@/lib/server/edulockAudit";

type EduLockAuthPayload = {
  action: "sync-profile" | "bootstrap-school-admin" | "send-reset-email" | "password-changed";
  npsn?: string;
  email?: string;
};

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizeNpsn(value: unknown): string {
  return normalizeText(value);
}

async function waitForBestEffortSideEffects(tasks: Array<Promise<unknown>>, timeoutMs = 1200) {
  if (!tasks.length) return;

  await Promise.race([
    Promise.allSettled(tasks),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

async function lookupUserByIdToken(idToken: string) {
  const decoded = await getEduLockAdminAuth().verifyIdToken(idToken);
  const uid = normalizeText(decoded.uid);
  if (!uid) {
    throw new Error("UID pengguna EduLock tidak ditemukan.");
  }

  return {
    uid,
    email: normalizeEmail(decoded.email),
  };
}

async function resolveSchoolBindingByEmail(email: string) {
  const schoolsSnap = await getEduLockAdminDb().ref("schools").get();
  const schools = schoolsSnap.exists() ? schoolsSnap.val() || {} : {};
  for (const [key, value] of Object.entries<any>(schools)) {
    const authEmail = normalizeEmail(value?.authEmail);
    const adminEmail = normalizeEmail(value?.adminEmail);
    if (email !== authEmail && email !== adminEmail) continue;
    return {
      schoolId: normalizeText(value?.schoolId || key).toLowerCase(),
      schoolName: normalizeText(value?.name),
      npsn: normalizeText(value?.npsn),
      isActive: value?.isActive !== false,
      serviceActive: value?.serviceStatus?.serviceActive !== false,
      adminAccessActive: value?.adminAccessActive !== false,
    };
  }
  return null;
}

async function resolveSchoolBindingByNpsn(npsn: string) {
  const schoolIdSnap = await getEduLockAdminDb().ref(`npsn_index/${npsn}`).get();
  const schoolId = schoolIdSnap.exists() ? normalizeText(schoolIdSnap.val()).toLowerCase() : "";
  if (!schoolId) return null;

  const schoolSnap = await getEduLockAdminDb().ref(`schools/${schoolId}`).get();
  if (!schoolSnap.exists()) return null;
  const school = schoolSnap.val() || {};
  return {
    schoolId,
    schoolName: normalizeText(school?.name),
    npsn: normalizeText(school?.npsn || npsn),
    isActive: school?.isActive !== false,
    serviceActive: school?.serviceStatus?.serviceActive !== false,
    adminAccessActive: school?.adminAccessActive !== false,
  };
}

async function resolveBindingFromIdentity(email: string) {
  if (email.endsWith("@edulock.local")) {
    const npsn = normalizeNpsn(email.slice(0, email.indexOf("@")));
    if (!npsn) return null;
    return resolveSchoolBindingByNpsn(npsn);
  }
  return resolveSchoolBindingByEmail(email);
}

async function syncProfileFromToken(authorizationHeader?: string | null) {
  const token = String(authorizationHeader || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw new Error("Token otorisasi EduLock wajib dikirim.");
  }

  const identity = await lookupUserByIdToken(token);
  const db = getEduLockAdminDb();
  const auth = getEduLockAdminAuth();
  const now = Date.now();
  const profileRef = db.ref(`admin_profiles/${identity.uid}`);
  const profileSnap = await profileRef.get();
  const raw = profileSnap.exists() ? profileSnap.val() || {} : null;
  const existingRole = raw?.role === "super_admin" ? "super_admin" : "admin";

  if (existingRole === "super_admin") {
    if (raw?.isActive === false) {
      throw new Error("Akun admin dinonaktifkan. Silakan hubungi super admin.");
    }

    const nextProfile = {
      uid: normalizeText(raw?.uid || identity.uid),
      email: normalizeEmail(identity.email || raw?.email),
      role: "super_admin" as const,
      isActive: raw?.isActive !== false,
      schoolId: normalizeText(raw?.schoolId),
      schoolName: normalizeText(raw?.schoolName),
      npsn: normalizeText(raw?.npsn) || undefined,
      mustChangePassword: raw?.mustChangePassword === true,
      passwordChangedAt: typeof raw?.passwordChangedAt === "number" ? raw.passwordChangedAt : null,
      createdAt: typeof raw?.createdAt === "number" ? raw.createdAt : now,
      updatedAt: now,
      lastLoginAt: now,
    };

    await profileRef.update({
      email: nextProfile.email,
      updatedAt: now,
      lastLoginAt: now,
    });
    await waitForBestEffortSideEffects([
      auth.setCustomUserClaims(nextProfile.uid, {
        role: "super_admin",
        schoolId: nextProfile.schoolId || undefined,
        npsn: nextProfile.npsn || undefined,
      }),
      writeEduLockAuditEvent(nextProfile, {
        type: "edulock.auth.profile_synced",
        message: "Profil super admin EduLock tersinkron setelah login.",
        schoolId: nextProfile.schoolId,
        targetUid: nextProfile.uid,
      }),
    ]);

    return nextProfile;
  }

  const binding = await resolveBindingFromIdentity(identity.email);
  if (!binding) {
    throw new Error("Akun admin sekolah belum terdaftar di registry admin.");
  }
  if (!binding.isActive) {
    throw new Error("Sekolah nonaktif. Silakan hubungi super admin.");
  }
  if (!binding.serviceActive) {
    throw new Error("Layanan sekolah sedang dinonaktifkan oleh super admin.");
  }
  if (!binding.adminAccessActive || raw?.isActive === false) {
    throw new Error("Akses admin sekolah dinonaktifkan oleh super admin.");
  }

  const nextProfile = {
    uid: identity.uid,
    email: identity.email,
    role: "admin" as const,
    isActive: true,
    schoolId: binding.schoolId,
    schoolName: binding.schoolName,
    npsn: binding.npsn || undefined,
    mustChangePassword: raw?.mustChangePassword === true,
    passwordChangedAt: typeof raw?.passwordChangedAt === "number" ? raw.passwordChangedAt : null,
    createdAt: typeof raw?.createdAt === "number" ? raw.createdAt : now,
    updatedAt: now,
    lastLoginAt: now,
  };

  await profileRef.set(nextProfile);
  await waitForBestEffortSideEffects([
    auth.setCustomUserClaims(nextProfile.uid, {
      role: "admin",
      schoolId: nextProfile.schoolId,
      npsn: nextProfile.npsn || undefined,
    }),
    writeEduLockAuditEvent(nextProfile, {
      type: "edulock.auth.profile_synced",
      message: `Profil admin sekolah ${nextProfile.schoolId} tersinkron setelah login.`,
      schoolId: nextProfile.schoolId,
      targetUid: nextProfile.uid,
    }),
  ]);
  return nextProfile;
}

async function bootstrapSchoolAdmin(payload: EduLockAuthPayload) {
  const npsn = normalizeNpsn(payload.npsn);
  if (!npsn) {
    throw new Error("NPSN wajib diisi.");
  }

  const binding = await resolveSchoolBindingByNpsn(npsn);
  if (!binding) {
    throw new Error("NPSN tidak ditemukan atau belum didaftarkan oleh admin pusat.");
  }
  if (!binding.isActive) {
    throw new Error("Sekolah nonaktif. Hubungi super admin.");
  }
  if (!binding.serviceActive) {
    throw new Error("Layanan sekolah sedang dinonaktifkan oleh super admin.");
  }
  if (!binding.adminAccessActive) {
    throw new Error("Akses admin sekolah dinonaktifkan oleh super admin.");
  }

  const systemEmail = `${npsn}@edulock.local`;
  const auth = getEduLockAdminAuth();
  const db = getEduLockAdminDb();
  let userRecord;
  let created = false;
  let userAlreadyExists = false;

  try {
    userRecord = await auth.getUserByEmail(systemEmail);
    userAlreadyExists = true;
  } catch (error: any) {
    if (error?.code !== "auth/user-not-found") {
      throw error;
    }
    userRecord = await auth.createUser({
      email: systemEmail,
      password: "admin123",
      emailVerified: true,
      disabled: false,
    });
    created = true;
  }

  const now = Date.now();
  const profileRef = db.ref(`admin_profiles/${userRecord.uid}`);
  const existingProfileSnap = await profileRef.get();
  const existingProfile = existingProfileSnap.exists() ? existingProfileSnap.val() || {} : {};
  const passwordAlreadyChanged =
    existingProfile?.mustChangePassword === false &&
    typeof existingProfile?.passwordChangedAt === "number" &&
    existingProfile.passwordChangedAt > 0;
  const shouldPrepareDefault =
    created ||
    !existingProfileSnap.exists() ||
    existingProfile?.mustChangePassword === true ||
    !passwordAlreadyChanged;

  // Jalur bootstrap login pertama hanya boleh menyiapkan akun yang memang
  // belum ada. Reset default untuk akun yang sudah pernah hidup harus lewat
  // route super admin yang terautentikasi.
  if (userAlreadyExists && existingProfileSnap.exists()) {
    await auth.setCustomUserClaims(userRecord.uid, {
      role: "admin",
      schoolId: binding.schoolId,
      npsn: binding.npsn || undefined,
    });
    return {
      created: false,
      defaultReady: false,
      email: systemEmail,
      uid: userRecord.uid,
    };
  }

  if (!shouldPrepareDefault) {
    return {
      created: false,
      defaultReady: false,
      email: systemEmail,
      uid: userRecord.uid,
    };
  }

  await profileRef.set({
    uid: userRecord.uid,
    email: systemEmail,
    role: "admin",
    isActive: true,
    schoolId: binding.schoolId,
    schoolName: binding.schoolName,
    npsn: binding.npsn,
    mustChangePassword: true,
    passwordChangedAt: null,
    createdAt: typeof existingProfile?.createdAt === "number" ? existingProfile.createdAt : now,
    updatedAt: now,
    lastLoginAt: typeof existingProfile?.lastLoginAt === "number" ? existingProfile.lastLoginAt : null,
  });
  await auth.setCustomUserClaims(userRecord.uid, {
    role: "admin",
    schoolId: binding.schoolId,
    npsn: binding.npsn || undefined,
  });
  await db.ref(`schools/${binding.schoolId}`).update({ updatedAt: now });
  await writeEduLockAuditEvent({ uid: "system", email: "system@edulock", role: "system" }, {
    type: "edulock.auth.school_admin_bootstrapped",
    message: `Akun admin sekolah ${binding.schoolId} disiapkan untuk login default.`,
    schoolId: binding.schoolId,
    targetUid: userRecord.uid,
    metadata: { email: systemEmail, npsn: binding.npsn || "", created },
  });

  return {
    created: true,
    defaultReady: true,
    email: systemEmail,
    uid: userRecord.uid,
  };
}

async function sendResetEmail(payload: EduLockAuthPayload) {
  const email = normalizeEmail(payload.email);
  if (!email || !email.includes("@")) {
    throw new Error("Email reset tidak valid.");
  }

  if (email.endsWith("@edulock.local")) {
    throw new Error(
      "Reset password admin sekolah berbasis NPSN hanya boleh dilakukan oleh super admin melalui aksi Reset Default."
    );
  }

  const schoolBinding = await resolveBindingFromIdentity(email);
  if (schoolBinding) {
    throw new Error(
      "Reset password admin sekolah dilakukan oleh super admin dari halaman Database Super Admin agar username tetap NPSN dan password kembali ke admin123."
    );
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_BOUNDARY.edulock.apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email,
      }),
      cache: "no-store",
    }
  );

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String((result as any)?.error?.message || "Gagal mengirim reset password."));
  }

  const binding = await resolveBindingFromIdentity(email);
  await writeEduLockAuditEvent({ uid: "system", email: "system@edulock", role: "system", schoolId: binding?.schoolId }, {
    type: "edulock.auth.reset_email_sent",
    message: `Email reset password dikirim untuk ${email}.`,
    schoolId: binding?.schoolId,
    targetId: email,
  });
}

async function markPasswordChanged(authorizationHeader?: string | null) {
  const token = String(authorizationHeader || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw new Error("Token otorisasi EduLock wajib dikirim.");
  }

  const identity = await lookupUserByIdToken(token);
  const now = Date.now();
  const profileRef = getEduLockAdminDb().ref(`admin_profiles/${identity.uid}`);
  const profileSnap = await profileRef.get();
  const raw = profileSnap.exists() ? profileSnap.val() || {} : {};
  await profileRef.update({
    mustChangePassword: false,
    passwordChangedAt: now,
    updatedAt: now,
  });
  await writeEduLockAuditEvent({
    uid: identity.uid,
    email: identity.email,
    role: normalizeText(raw.role),
    schoolId: normalizeText(raw.schoolId),
    schoolName: normalizeText(raw.schoolName),
  }, {
    type: "edulock.auth.password_changed",
    message: "Metadata perubahan password admin EduLock diperbarui melalui route auth.",
    schoolId: normalizeText(raw.schoolId),
    targetUid: identity.uid,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EduLockAuthPayload;
    if (body.action === "sync-profile") {
      const profile = await syncProfileFromToken(request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Profil admin EduLock tersinkron.", data: { profile } });
    }
    if (body.action === "bootstrap-school-admin") {
      const result = await bootstrapSchoolAdmin(body);
      return NextResponse.json({ success: true, message: "Bootstrap admin sekolah selesai.", data: result });
    }
    if (body.action === "send-reset-email") {
      await sendResetEmail(body);
      return NextResponse.json({ success: true, message: "Email reset password berhasil dikirim." });
    }
    if (body.action === "password-changed") {
      await markPasswordChanged(request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Metadata password berhasil diperbarui." });
    }
    return NextResponse.json({ success: false, message: "Aksi auth EduLock tidak valid." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}
