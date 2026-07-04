import { NextRequest, NextResponse } from "next/server";
import { getEduLockAdminAuth, getEduLockAdminDb } from "@/lib/server/firebaseAdmin";
import { enforceAdminCapability } from "@/lib/server/adminPolicy";
import { writeEduLockAuditEvent } from "@/lib/server/edulockAudit";

type EduLockSuperPayload = {
  action:
    | "toggle-school-admin-access"
    | "reset-school-admin-default-password"
    | "save-admin-api-url"
    | "save-school"
    | "save-school-service-status"
    | "toggle-school-active"
    | "generate-uninstall-code"
    | "revoke-uninstall-code"
    | "toggle-admin-active"
    | "save-global-config"
    | "create-broadcast"
    | "delete-broadcast"
    | "create-support-request"
    | "set-support-request-status"
    | "delete-support-request"
    | "create-sync-job"
    | "set-sync-job-status";
  schoolId?: string;
  targetUid?: string;
  targetId?: string;
  nextActive?: boolean;
  adminApiBaseUrl?: string;
  config?: Record<string, unknown>;
  broadcast?: {
    title?: string;
    message?: string;
    target?: {
      mode?: "ALL" | "SCHOOL";
      schoolId?: string;
    };
  };
  supportRequest?: {
    type?: "clear_cache" | "rerun_sync" | "reset_access";
    schoolId?: string;
    reason?: string;
    status?: "OPEN" | "DONE" | "CANCELLED";
  };
  syncJob?: {
    type?: "master_data" | "attendance" | "users";
    schoolId?: string;
    note?: string;
    status?: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
  };
  school?: {
    schoolId?: string;
    name?: string;
    district?: string;
    npsn?: string;
    authEmail?: string;
    adminEmail?: string;
    backupEmail?: string;
    isActive?: boolean;
  };
  serviceStatus?: {
    paymentStatus?: "PAID" | "UNPAID";
    note?: string;
    confirmedAt?: number | null;
  };
  uninstallDurationMinutes?: number;
};

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSchoolId(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizeActorEmail(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function ensureObjectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} harus berupa object JSON.`);
  }
  return value as Record<string, unknown>;
}

function generateNumericCode(length: number) {
  const digits = "0123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) out += digits[Math.floor(Math.random() * digits.length)];
  return out;
}

async function requireSuperAdmin(authorizationHeader?: string | null) {
  const context = await enforceAdminCapability(
    authorizationHeader,
    "super-admin.database.write",
    { allowGlobalForSuperAdmin: true }
  );
  return context.profile;
}

async function toggleSchoolAdminAccess(payload: EduLockSuperPayload, authorizationHeader?: string | null) {
  const profile = await requireSuperAdmin(authorizationHeader);
  const schoolId = normalizeSchoolId(payload.schoolId);
  if (!schoolId) {
    throw new Error("schoolId tidak valid.");
  }

  const now = Date.now();
  const nextActive = payload.nextActive !== false;
  const db = getEduLockAdminDb();
  const adminProfilesSnap = await db.ref("admin_profiles").get();
  const adminProfiles = adminProfilesSnap.exists() ? adminProfilesSnap.val() || {} : {};

  const updatesObj: Record<string, any> = {
    [`schools/${schoolId}/adminAccessActive`]: nextActive,
    [`schools/${schoolId}/updatedAt`]: now,
  };

  for (const [uid, admin] of Object.entries<any>(adminProfiles)) {
    if (String(admin?.role || "") !== "admin") continue;
    if (normalizeSchoolId(admin?.schoolId) !== schoolId) continue;
    updatesObj[`admin_profiles/${uid}/isActive`] = nextActive;
    updatesObj[`admin_profiles/${uid}/updatedAt`] = now;
  }

  await db.ref().update(updatesObj);
  await writeEduLockAuditEvent(profile, {
    type: "edulock.super.school_admin_access_toggled",
    message: `Akses login admin sekolah ${schoolId} ${nextActive ? "diaktifkan" : "dinonaktifkan"}.`,
    schoolId,
    metadata: { nextActive },
  });
}

async function resetSchoolAdminDefaultPassword(payload: EduLockSuperPayload, authorizationHeader?: string | null) {
  const profile = await requireSuperAdmin(authorizationHeader);
  const schoolId = normalizeSchoolId(payload.schoolId);
  if (!schoolId) {
    throw new Error("schoolId tidak valid.");
  }

  const db = getEduLockAdminDb();
  const schoolSnap = await db.ref(`schools/${schoolId}`).get();
  if (!schoolSnap.exists()) {
    throw new Error("Data sekolah tidak ditemukan.");
  }

  const school = schoolSnap.val() || {};
  const npsn = normalizeText(school?.npsn);
  if (!npsn) {
    throw new Error("NPSN sekolah wajib diisi sebelum reset password admin.");
  }

  const auth = getEduLockAdminAuth();
  const systemEmail = `${npsn}@edulock.local`;
  const now = Date.now();

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(systemEmail);
    await auth.updateUser(userRecord.uid, {
      password: "admin123",
      disabled: false,
      emailVerified: true,
    });
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
  }

  const profileRef = db.ref(`admin_profiles/${userRecord.uid}`);
  const existingProfileSnap = await profileRef.get();
  const existingProfile = existingProfileSnap.exists() ? existingProfileSnap.val() || {} : {};

  await profileRef.set({
    uid: userRecord.uid,
    email: systemEmail,
    role: "admin",
    isActive: school?.adminAccessActive !== false,
    schoolId,
    schoolName: normalizeText(school?.name),
    npsn,
    mustChangePassword: true,
    passwordChangedAt: null,
    createdAt: typeof existingProfile?.createdAt === "number" ? existingProfile.createdAt : now,
    updatedAt: now,
    lastLoginAt: typeof existingProfile?.lastLoginAt === "number" ? existingProfile.lastLoginAt : null,
  });

  await db.ref(`schools/${schoolId}`).update({ updatedAt: now });
  await writeEduLockAuditEvent(profile, {
    type: "edulock.super.school_admin_default_password_reset",
    message: `Password default admin sekolah ${schoolId} direset ke admin123.`,
    schoolId,
    targetUid: userRecord.uid,
    metadata: {
      npsn,
      username: npsn,
      runtimeEmail: systemEmail,
    },
  });
}

async function saveAdminApiUrl(payload: EduLockSuperPayload, authorizationHeader?: string | null) {
  const profile = await requireSuperAdmin(authorizationHeader);
  const url = normalizeText(payload.adminApiBaseUrl);
  await getEduLockAdminDb().ref("system_config/adminApiBaseUrl").set(url);
  await writeEduLockAuditEvent(profile, {
    type: "edulock.super.admin_api_url_saved",
    message: "Admin API Base URL EduLock diperbarui.",
    metadata: { url },
  });
}

async function saveSchool(payload: EduLockSuperPayload, authorizationHeader?: string | null) {
  const profile = await requireSuperAdmin(authorizationHeader);
  const schoolForm = payload.school || {};
  const schoolId = normalizeSchoolId(schoolForm.schoolId);
  if (!schoolId) {
    throw new Error("School ID wajib diisi.");
  }

  const db = getEduLockAdminDb();
  const now = Date.now();
  const existingSnap = await db.ref(`schools/${schoolId}`).get();
  const existing = existingSnap.exists() ? existingSnap.val() || {} : null;

  const schoolPayload: Record<string, any> = {
    schoolId,
    name: normalizeText(schoolForm.name),
    district: normalizeText(schoolForm.district),
    npsn: normalizeText(schoolForm.npsn),
    authEmail: normalizeText(schoolForm.authEmail).toLowerCase(),
    adminEmail: normalizeText(schoolForm.adminEmail).toLowerCase(),
    backupEmail: normalizeText(schoolForm.backupEmail).toLowerCase(),
    isActive: schoolForm.isActive !== false,
    adminAccessActive: existing?.adminAccessActive === false ? false : true,
    updatedAt: now,
    createdAt: existing?.createdAt || now,
  };

  const updatesObj: Record<string, any> = {
    [`schools/${schoolId}`]: schoolPayload,
  };

  if (schoolPayload.npsn) {
    updatesObj[`npsn_index/${schoolPayload.npsn}`] = schoolId;
  }

  const previousNpsn = normalizeText(existing?.npsn);
  if (previousNpsn && previousNpsn !== schoolPayload.npsn) {
    updatesObj[`npsn_index/${previousNpsn}`] = null;
  }

  await db.ref().update(updatesObj);
  await writeEduLockAuditEvent(profile, {
    type: existing ? "edulock.super.school_updated" : "edulock.super.school_created",
    message: `Registry sekolah ${schoolId} disimpan.`,
    schoolId,
    metadata: { npsn: schoolPayload.npsn, isActive: schoolPayload.isActive },
  });
}

async function toggleSchoolActive(payload: EduLockSuperPayload, authorizationHeader?: string | null) {
  const profile = await requireSuperAdmin(authorizationHeader);
  const schoolId = normalizeSchoolId(payload.schoolId);
  if (!schoolId) {
    throw new Error("schoolId tidak valid.");
  }

  const nextActive = payload.nextActive !== false;
  await getEduLockAdminDb()
    .ref(`schools/${schoolId}`)
    .update({ isActive: nextActive, updatedAt: Date.now() });
  await writeEduLockAuditEvent(profile, {
    type: "edulock.super.school_active_toggled",
    message: `Status sekolah ${schoolId} ${nextActive ? "diaktifkan" : "dinonaktifkan"}.`,
    schoolId,
    metadata: { nextActive },
  });
}

async function saveSchoolServiceStatus(payload: EduLockSuperPayload, authorizationHeader?: string | null) {
  const profile = await requireSuperAdmin(authorizationHeader);
  const schoolId = normalizeSchoolId(payload.schoolId);
  if (!schoolId) {
    throw new Error("schoolId tidak valid.");
  }

  const patch = ensureObjectRecord(payload.serviceStatus, "Status layanan");
  const db = getEduLockAdminDb();
  const schoolSnap = await db.ref(`schools/${schoolId}`).get();
  if (!schoolSnap.exists()) {
    throw new Error("Data sekolah tidak ditemukan.");
  }

  const school = schoolSnap.val() || {};
  const current = school?.serviceStatus && typeof school.serviceStatus === "object" ? school.serviceStatus : {};
  const now = Date.now();
  const rawPaymentStatus = Object.prototype.hasOwnProperty.call(patch, "paymentStatus")
    ? normalizeText(patch.paymentStatus).toUpperCase()
    : "";

  const nextPaymentStatus =
    rawPaymentStatus === "PAID"
      ? "PAID"
      : rawPaymentStatus === "UNPAID"
        ? "UNPAID"
        : normalizeText(current?.paymentStatus).toUpperCase() === "PAID"
          ? "PAID"
          : "UNPAID";

  const nextNote = Object.prototype.hasOwnProperty.call(patch, "note")
    ? normalizeText(patch.note)
    : normalizeText(current?.note);

  const nextConfirmedAt =
    typeof patch.confirmedAt === "number"
      ? patch.confirmedAt
      : rawPaymentStatus
        ? now
        : typeof current?.confirmedAt === "number"
          ? current.confirmedAt
          : null;

  await db.ref().update({
    [`schools/${schoolId}/serviceStatus/paymentStatus`]: nextPaymentStatus,
    [`schools/${schoolId}/serviceStatus/note`]: nextNote,
    [`schools/${schoolId}/serviceStatus/confirmedAt`]: nextConfirmedAt,
    [`schools/${schoolId}/serviceStatus/updatedAt`]: now,
    [`schools/${schoolId}/serviceStatus/updatedBy`]: normalizeActorEmail(profile.email || profile.uid || "super_admin"),
    [`schools/${schoolId}/updatedAt`]: now,
  });

  await writeEduLockAuditEvent(profile, {
    type: "edulock.super.school_service_status_saved",
    message: `Status layanan sekolah ${schoolId} diperbarui.`,
    schoolId,
    metadata: {
      paymentStatus: nextPaymentStatus,
      hasNote: Boolean(nextNote),
    },
  });
}

async function toggleAdminActive(payload: EduLockSuperPayload, authorizationHeader?: string | null) {
  const profile = await requireSuperAdmin(authorizationHeader);
  const uid = normalizeText(payload.targetUid);
  if (!uid) {
    throw new Error("UID admin tidak valid.");
  }

  const nextActive = payload.nextActive !== false;
  await getEduLockAdminDb()
    .ref(`admin_profiles/${uid}`)
    .update({ isActive: nextActive, updatedAt: Date.now() });
  
  await writeEduLockAuditEvent(profile, {
    type: "edulock.super.admin_active_toggled",
    message: `Status admin ${uid} ${nextActive ? "diaktifkan" : "dinonaktifkan"}.`,
    targetUid: uid,
    metadata: { nextActive },
  });
}

async function generateUninstallCode(payload: EduLockSuperPayload, authorizationHeader?: string | null) {
  const profile = await requireSuperAdmin(authorizationHeader);
  const schoolId = normalizeSchoolId(payload.schoolId);
  if (!schoolId) {
    throw new Error("Pilih sekolah terlebih dahulu.");
  }

  const minutes = Number(payload.uninstallDurationMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error("Durasi harus > 0 menit.");
  }

  const code = generateNumericCode(6);
  const nowTs = Date.now();
  const expiresAt = nowTs + Math.round(minutes * 60 * 1000);
  const createdBy = normalizeText(profile.email).toLowerCase() || "super_admin";

  await getEduLockAdminDb().ref(`schools/${schoolId}/uninstallAccess`).set({
    code,
    expiresAt,
    createdAt: nowTs,
    updatedAt: nowTs,
    createdBy,
  });
  await writeEduLockAuditEvent(profile, {
    type: "edulock.super.uninstall_code_generated",
    message: `Kode uninstall untuk sekolah ${schoolId} dibuat.`,
    schoolId,
    targetId: code,
    metadata: { expiresAt, minutes },
  });

  return { code, expiresAt };
}

async function revokeUninstallCode(payload: EduLockSuperPayload, authorizationHeader?: string | null) {
  const profile = await requireSuperAdmin(authorizationHeader);
  const schoolId = normalizeSchoolId(payload.schoolId);
  if (!schoolId) {
    throw new Error("Pilih sekolah terlebih dahulu.");
  }

  await getEduLockAdminDb().ref(`schools/${schoolId}/uninstallAccess`).remove();
  await writeEduLockAuditEvent(profile, {
    type: "edulock.super.uninstall_code_revoked",
    message: `Kode uninstall untuk sekolah ${schoolId} dicabut.`,
    schoolId,
  });
}

async function saveGlobalConfig(payload: EduLockSuperPayload, authorizationHeader?: string | null) {
  const profile = await requireSuperAdmin(authorizationHeader);
  const config = ensureObjectRecord(payload.config, "Konfigurasi");
  const now = Date.now();
  const updatedBy = normalizeActorEmail(profile.email || profile.uid || "super_admin");
  await getEduLockAdminDb().ref("gas/global_config").set({
    ...config,
    _updatedAt: now,
    _updatedBy: updatedBy,
  });
  await writeEduLockAuditEvent(profile, {
    type: "edulock.super.global_config_saved",
    message: "Konfigurasi global GAS diperbarui.",
    metadata: {
      keys: Object.keys(config).filter((key) => !key.startsWith("_")).length,
    },
  });
}

async function createBroadcast(payload: EduLockSuperPayload, authorizationHeader?: string | null) {
  const profile = await requireSuperAdmin(authorizationHeader);
  const title = normalizeText(payload.broadcast?.title);
  const message = normalizeText(payload.broadcast?.message);
  const targetMode = payload.broadcast?.target?.mode === "SCHOOL" ? "SCHOOL" : "ALL";
  const targetSchoolId = targetMode === "SCHOOL" ? normalizeSchoolId(payload.broadcast?.target?.schoolId) : "";

  if (!title || !message) {
    throw new Error("Judul dan pesan broadcast wajib diisi.");
  }
  if (targetMode === "SCHOOL" && !targetSchoolId) {
    throw new Error("schoolId wajib diisi untuk target SCHOOL.");
  }

  const now = Date.now();
  const createdBy = normalizeActorEmail(profile.email || profile.uid || "super_admin");
  const target =
    targetMode === "SCHOOL"
      ? { mode: "SCHOOL" as const, schoolId: targetSchoolId }
      : { mode: "ALL" as const };
  const broadcastRef = getEduLockAdminDb().ref("gas/broadcasts").push();

  await broadcastRef.set({
    id: broadcastRef.key,
    title,
    message,
    target,
    createdAt: now,
    createdBy,
  });

  await writeEduLockAuditEvent(profile, {
    type: "edulock.super.broadcast_created",
    message: `Broadcast ${broadcastRef.key || "-"} dibuat.`,
    schoolId: targetMode === "SCHOOL" ? targetSchoolId : undefined,
    targetId: broadcastRef.key || undefined,
    metadata: { targetMode },
  });

  return { id: broadcastRef.key };
}

async function deleteBroadcast(payload: EduLockSuperPayload, authorizationHeader?: string | null) {
  const profile = await requireSuperAdmin(authorizationHeader);
  const broadcastId = normalizeText(payload.targetId);
  if (!broadcastId) {
    throw new Error("ID broadcast tidak valid.");
  }

  await getEduLockAdminDb().ref(`gas/broadcasts/${broadcastId}`).remove();
  await writeEduLockAuditEvent(profile, {
    type: "edulock.super.broadcast_deleted",
    message: `Broadcast ${broadcastId} dihapus.`,
    targetId: broadcastId,
  });
}

async function createSupportRequest(payload: EduLockSuperPayload, authorizationHeader?: string | null) {
  const profile = await requireSuperAdmin(authorizationHeader);
  const type = normalizeText(payload.supportRequest?.type) as "clear_cache" | "rerun_sync" | "reset_access";
  const schoolId = normalizeSchoolId(payload.supportRequest?.schoolId);
  const reason = normalizeText(payload.supportRequest?.reason);

  if (!["clear_cache", "rerun_sync", "reset_access"].includes(type)) {
    throw new Error("Tipe support request tidak valid.");
  }
  if (!schoolId) {
    throw new Error("schoolId wajib diisi.");
  }

  const now = Date.now();
  const actor = normalizeActorEmail(profile.email || profile.uid || "super_admin");
  const requestRef = getEduLockAdminDb().ref("gas/support_requests").push();

  await requestRef.set({
    id: requestRef.key,
    type,
    schoolId,
    reason: reason || null,
    status: "OPEN",
    createdAt: now,
    updatedAt: now,
    createdBy: actor,
    updatedBy: actor,
  });

  await writeEduLockAuditEvent(profile, {
    type: "edulock.super.support_request_created",
    message: `Support request ${requestRef.key || "-"} dibuat.`,
    schoolId,
    targetId: requestRef.key || undefined,
    metadata: { requestType: type },
  });

  return { id: requestRef.key };
}

async function setSupportRequestStatus(payload: EduLockSuperPayload, authorizationHeader?: string | null) {
  const profile = await requireSuperAdmin(authorizationHeader);
  const requestId = normalizeText(payload.targetId);
  const status = normalizeText(payload.supportRequest?.status) as "OPEN" | "DONE" | "CANCELLED";
  if (!requestId) {
    throw new Error("ID support request tidak valid.");
  }
  if (!["OPEN", "DONE", "CANCELLED"].includes(status)) {
    throw new Error("Status support request tidak valid.");
  }

  const now = Date.now();
  await getEduLockAdminDb().ref(`gas/support_requests/${requestId}`).update({
    status,
    updatedAt: now,
    updatedBy: normalizeActorEmail(profile.email || profile.uid || "super_admin"),
  });

  await writeEduLockAuditEvent(profile, {
    type: "edulock.super.support_request_status_updated",
    message: `Status support request ${requestId} diubah menjadi ${status}.`,
    targetId: requestId,
    metadata: { status },
  });
}

async function deleteSupportRequest(payload: EduLockSuperPayload, authorizationHeader?: string | null) {
  const profile = await requireSuperAdmin(authorizationHeader);
  const requestId = normalizeText(payload.targetId);
  if (!requestId) {
    throw new Error("ID support request tidak valid.");
  }

  await getEduLockAdminDb().ref(`gas/support_requests/${requestId}`).remove();
  await writeEduLockAuditEvent(profile, {
    type: "edulock.super.support_request_deleted",
    message: `Support request ${requestId} dihapus.`,
    targetId: requestId,
  });
}

async function createSyncJob(payload: EduLockSuperPayload, authorizationHeader?: string | null) {
  const profile = await requireSuperAdmin(authorizationHeader);
  const type = normalizeText(payload.syncJob?.type) as "master_data" | "attendance" | "users";
  const schoolId = normalizeSchoolId(payload.syncJob?.schoolId);
  const note = normalizeText(payload.syncJob?.note);

  if (!["master_data", "attendance", "users"].includes(type)) {
    throw new Error("Tipe sync job tidak valid.");
  }

  const now = Date.now();
  const jobRef = getEduLockAdminDb().ref("gas/sync_jobs").push();
  await jobRef.set({
    id: jobRef.key,
    type,
    status: "QUEUED",
    schoolId,
    note: note || null,
    createdAt: now,
    updatedAt: now,
    updatedBy: normalizeActorEmail(profile.email || profile.uid || "super_admin"),
  });

  await writeEduLockAuditEvent(profile, {
    type: "edulock.super.sync_job_created",
    message: `Sync job ${jobRef.key || "-"} dibuat.`,
    schoolId: schoolId || undefined,
    targetId: jobRef.key || undefined,
    metadata: { jobType: type },
  });

  return { id: jobRef.key };
}

async function setSyncJobStatus(payload: EduLockSuperPayload, authorizationHeader?: string | null) {
  const profile = await requireSuperAdmin(authorizationHeader);
  const jobId = normalizeText(payload.targetId);
  const status = normalizeText(payload.syncJob?.status) as "QUEUED" | "RUNNING" | "DONE" | "FAILED";
  if (!jobId) {
    throw new Error("ID sync job tidak valid.");
  }
  if (!["QUEUED", "RUNNING", "DONE", "FAILED"].includes(status)) {
    throw new Error("Status sync job tidak valid.");
  }

  await getEduLockAdminDb().ref(`gas/sync_jobs/${jobId}`).update({
    status,
    updatedAt: Date.now(),
    updatedBy: normalizeActorEmail(profile.email || profile.uid || "super_admin"),
  });

  await writeEduLockAuditEvent(profile, {
    type: "edulock.super.sync_job_status_updated",
    message: `Status sync job ${jobId} diubah menjadi ${status}.`,
    targetId: jobId,
    metadata: { status },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EduLockSuperPayload;
    if (body.action === "save-school") {
      await saveSchool(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Sekolah tersimpan." });
    }
    if (body.action === "save-school-service-status") {
      await saveSchoolServiceStatus(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Status layanan sekolah tersimpan." });
    }
    if (body.action === "save-admin-api-url") {
      await saveAdminApiUrl(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Admin API Base URL tersimpan." });
    }
    if (body.action === "generate-uninstall-code") {
      const result = await generateUninstallCode(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Kode uninstall berhasil dibuat.", data: result });
    }
    if (body.action === "save-global-config") {
      await saveGlobalConfig(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Konfigurasi global tersimpan." });
    }
    if (body.action === "create-broadcast") {
      const result = await createBroadcast(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Broadcast berhasil dibuat.", data: result });
    }
    if (body.action === "create-support-request") {
      const result = await createSupportRequest(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Support request berhasil dibuat.", data: result });
    }
    if (body.action === "create-sync-job") {
      const result = await createSyncJob(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Sync job berhasil dibuat.", data: result });
    }
    return NextResponse.json({ success: false, message: "Aksi super admin EduLock tidak valid." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as EduLockSuperPayload;
    if (body.action === "toggle-school-admin-access") {
      await toggleSchoolAdminAccess(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Akses login admin sekolah diperbarui." });
    }
    if (body.action === "reset-school-admin-default-password") {
      await resetSchoolAdminDefaultPassword(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Password default admin sekolah berhasil direset." });
    }
    if (body.action === "toggle-school-active") {
      await toggleSchoolActive(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Status sekolah diperbarui." });
    }
    if (body.action === "toggle-admin-active") {
      await toggleAdminActive(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Status admin diperbarui." });
    }
    if (body.action === "set-support-request-status") {
      await setSupportRequestStatus(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Status support request diperbarui." });
    }
    if (body.action === "set-sync-job-status") {
      await setSyncJobStatus(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Status sync job diperbarui." });
    }
    return NextResponse.json({ success: false, message: "Aksi super admin EduLock tidak valid." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as EduLockSuperPayload;
    if (body.action === "revoke-uninstall-code") {
      await revokeUninstallCode(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Kode uninstall dihapus." });
    }
    if (body.action === "delete-broadcast") {
      await deleteBroadcast(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Broadcast dihapus." });
    }
    if (body.action === "delete-support-request") {
      await deleteSupportRequest(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Support request dihapus." });
    }
    return NextResponse.json({ success: false, message: "Aksi super admin EduLock tidak valid." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}
