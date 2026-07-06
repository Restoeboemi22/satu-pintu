import { NextRequest, NextResponse } from "next/server";
import { getEduLockAdminDb } from "@/lib/server/firebaseAdmin";
import { requireEduLockAdminProfile } from "@/lib/server/edulockAuth";
import { writeEduLockAuditEvent } from "@/lib/server/edulockAudit";

type EduLockSecurityPayload = {
  action:
    | "password-changed"
    | "create-code"
    | "delete-code"
    | "delete-expired-codes"
    | "revoke-session"
    | "revoke-sessions-by-classes"
    | "set-uninstall-auth"
    | "bulk-grade9-uninstall-auth"
    | "save-class"
    | "save-weekday-schedule"
    | "save-holiday"
    | "import-students"
    | "save-config"
    | "save-gps-policy"
    | "set-config-flag"
    | "reset-student-device"
    | "delete-student"
    | "delete-holiday"
    | "delete-class"
    | "bulk-delete-students";
  schoolId?: string;
  code?: string;
  startTime?: string;
  endTime?: string;
  nisn?: string;
  className?: string;
  date?: string;
  note?: string;
  weekdaySchedule?: Record<string, { enabled?: boolean; start?: string; end?: string }>;
  students?: Array<{ nisn?: string; name?: string; class?: string }>;
  classKeyword?: string;
  classKeys?: string[];
  isAuthorized?: boolean;
  config?: Record<string, any>;
  gpsWarnMinutes?: number;
  gpsLockMinutes?: number;
  flag?: "is_active_protection" | "is_holiday_mode";
  value?: boolean;
};

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSchoolId(profile: Awaited<ReturnType<typeof requireEduLockAdminProfile>>, payloadSchoolId?: string) {
  const requestedSchoolId = normalizeText(payloadSchoolId).toLowerCase();
  if (profile.role === "admin") {
    if (!profile.schoolId) {
      throw new Error("Akun admin sekolah tidak memiliki schoolId yang valid.");
    }
    return profile.schoolId.toLowerCase();
  }
  if (!requestedSchoolId) {
    throw new Error("schoolId wajib diisi untuk operasi super admin.");
  }
  return requestedSchoolId;
}

function normalizeClassKey(value: unknown) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";

  const compact = raw.replace(/\s+/g, "").replace(/-/g, "");
  const compactMatch = compact.match(/(VIII|VII|IX|7|8|9)([A-Z])/);
  if (compactMatch) {
    const gradePart = compactMatch[1];
    const letter = compactMatch[2];
    const grade = gradePart === "VII" ? "7" : gradePart === "VIII" ? "8" : gradePart === "IX" ? "9" : gradePart;
    return `${grade}${letter}`;
  }

  const looseMatch = raw.match(/(VIII|VII|IX|7|8|9)\s*[- ]?\s*([A-Z])\b/);
  if (looseMatch) {
    const gradePart = looseMatch[1];
    const letter = looseMatch[2];
    const grade = gradePart === "VII" ? "7" : gradePart === "VIII" ? "8" : gradePart === "IX" ? "9" : gradePart;
    return `${grade}${letter}`;
  }

  return raw.replace(/[^A-Z0-9]/g, "");
}

function isGrade9Class(value: unknown) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return false;
  if (/^9\b/.test(raw)) return true;
  if (/^IX\b/.test(raw)) return true;
  if (/^KELAS\s*9\b/.test(raw)) return true;
  if (/^KELAS\s*IX\b/.test(raw)) return true;
  return false;
}

function parseMinutes(value: unknown) {
  const [h, m] = String(value || "").split(":").map((item) => Number(item));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

async function requireStudentInSchool(nisn: string, schoolId: string) {
  const snapshot = await getEduLockAdminDb().ref(`students/${nisn}`).get();
  if (!snapshot.exists()) {
    throw new Error("Data siswa tidak ditemukan.");
  }
  const student = snapshot.val() || {};
  if (normalizeText(student.schoolId).toLowerCase() !== schoolId) {
    throw new Error("Siswa berada di luar tenant admin aktif.");
  }
  return student;
}

function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function parseMinutesFromRange(startTime: string, endTime: string) {
  const parseHM = (s: string) => {
    const [h, m] = String(s || "00:00")
      .split(":")
      .map((v) => parseInt(v, 10));
    const d = new Date();
    d.setHours(Number.isFinite(h) ? h : 0);
    d.setMinutes(Number.isFinite(m) ? m : 0);
    d.setSeconds(0);
    d.setMilliseconds(0);
    return d;
  };

  const startD = parseHM(startTime);
  const endD = parseHM(endTime);
  if (endD.getTime() <= startD.getTime()) {
    throw new Error("Jam akhir harus lebih besar dari jam mulai.");
  }
  return Math.max(1, Math.floor((endD.getTime() - startD.getTime()) / 60000));
}

async function getStudentKeysBySchool(schoolId: string) {
  const snapshot = await getEduLockAdminDb().ref(`students_by_school/${schoolId}`).get();
  if (!snapshot.exists()) return [] as string[];
  return Object.keys(snapshot.val() || {}).map((key) => String(key || "").trim()).filter(Boolean);
}

async function getStudentsBySchool(schoolId: string) {
  const keys = await getStudentKeysBySchool(schoolId);
  if (keys.length === 0) return [] as Array<{ nisn: string; className: string }>;

  const refs = keys.map((nisn) => getEduLockAdminDb().ref(`students/${nisn}`).get());
  const snapshots = await Promise.all(refs);
  return snapshots
    .map((snapshot, index) => {
      const nisn = keys[index];
      const value = snapshot.exists() ? snapshot.val() || {} : {};
      return {
        nisn,
        className: normalizeText(value?.class),
      };
    })
    .filter((item) => item.nisn);
}

async function markPasswordChanged(payload: EduLockSecurityPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const schoolId = normalizeSchoolId(profile, payload.schoolId);
  if (profile.role === "admin" && profile.schoolId.toLowerCase() !== schoolId) {
    throw new Error("Operasi keamanan berada di luar tenant admin aktif.");
  }

  const now = Date.now();
  await getEduLockAdminDb().ref(`admin_profiles/${profile.uid}`).update({
    mustChangePassword: false,
    passwordChangedAt: now,
    updatedAt: now,
  });
  await writeEduLockAuditEvent(profile, {
    type: "edulock.security.password_changed",
    message: "Admin EduLock memperbarui metadata perubahan password.",
    schoolId,
    targetUid: profile.uid,
  });
}

async function createAccessCode(payload: EduLockSecurityPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const schoolId = normalizeSchoolId(profile, payload.schoolId);
  const startTime = normalizeText(payload.startTime);
  const endTime = normalizeText(payload.endTime);
  const durationMinutes = parseMinutesFromRange(startTime, endTime);
  const code = generateCode();
  const now = Date.now();
  const expiresAt = now + 2 * 60 * 1000;

  await getEduLockAdminDb().ref(`active_codes/${code}`).set({
    duration: durationMinutes,
    sessionStart: startTime,
    sessionEnd: endTime,
    expiresAt,
    createdAt: now,
    schoolId,
    schoolName: profile.role === "admin" ? profile.schoolName : normalizeText(profile.schoolName || payload.schoolId),
  });
  await writeEduLockAuditEvent(profile, {
    type: "edulock.security.access_code_created",
    message: `Kode akses ${code} dibuat untuk sesi ${startTime}-${endTime}.`,
    schoolId,
    targetId: code,
    metadata: { durationMinutes, expiresAt },
  });

  return { code };
}

async function deleteAccessCode(payload: EduLockSecurityPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const schoolId = normalizeSchoolId(profile, payload.schoolId);
  const code = normalizeText(payload.code);
  if (!code) {
    throw new Error("Kode akses tidak valid.");
  }

  const snapshot = await getEduLockAdminDb().ref(`active_codes/${code}`).get();
  if (!snapshot.exists()) {
    throw new Error("Kode akses tidak ditemukan.");
  }

  const record = snapshot.val() || {};
  if (normalizeText(record.schoolId).toLowerCase() !== schoolId) {
    throw new Error("Kode akses berada di luar tenant admin aktif.");
  }

  await getEduLockAdminDb().ref(`active_codes/${code}`).remove();
  await writeEduLockAuditEvent(profile, {
    type: "edulock.security.access_code_deleted",
    message: `Kode akses ${code} dihapus.`,
    schoolId,
    targetId: code,
  });
}

async function deleteExpiredCodes(payload: EduLockSecurityPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const schoolId = normalizeSchoolId(profile, payload.schoolId);
  const snapshot = await getEduLockAdminDb().ref("active_codes").get();
  if (!snapshot.exists()) {
    return { count: 0 };
  }

  const now = Date.now();
  const updates: Record<string, any> = {};
  let count = 0;
  for (const [code, value] of Object.entries<any>(snapshot.val() || {})) {
    if (normalizeText(value?.schoolId).toLowerCase() !== schoolId) continue;
    const expiresAt = Number(value?.expiresAt || 0);
    if (expiresAt > 0 && expiresAt < now) {
      updates[`active_codes/${code}`] = null;
      count += 1;
    }
  }

  if (count > 0) {
    await getEduLockAdminDb().ref().update(updates);
  }
  await writeEduLockAuditEvent(profile, {
    type: "edulock.security.expired_codes_deleted",
    message: `Membersihkan ${count} kode akses expired.`,
    schoolId,
    metadata: { count },
  });

  return { count };
}

async function revokeSingleSession(payload: EduLockSecurityPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const schoolId = normalizeSchoolId(profile, payload.schoolId);
  const nisn = normalizeText(payload.nisn);
  if (!nisn) {
    throw new Error("NISN tidak valid.");
  }

  await getEduLockAdminDb().ref().update({
    [`active_sessions/${nisn}`]: null,
    [`active_sessions_by_school/${schoolId}/${nisn}`]: null,
  });
  await writeEduLockAuditEvent(profile, {
    type: "edulock.security.session_revoked",
    message: `Sesi aktif siswa ${nisn} dicabut.`,
    schoolId,
    targetId: nisn,
  });
}

async function revokeSessionsByClasses(payload: EduLockSecurityPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const schoolId = normalizeSchoolId(profile, payload.schoolId);
  const classKeys = new Set((payload.classKeys || []).map((item) => normalizeClassKey(item)).filter(Boolean));
  if (classKeys.size === 0) {
    throw new Error("Daftar kelas tidak valid.");
  }

  const students = await getStudentsBySchool(schoolId);
  const targets = students.filter((student) => classKeys.has(normalizeClassKey(student.className)));
  if (targets.length === 0) {
    return { count: 0 };
  }

  const updates: Record<string, any> = {};
  for (const student of targets) {
    updates[`active_sessions/${student.nisn}`] = null;
    updates[`active_sessions_by_school/${schoolId}/${student.nisn}`] = null;
  }

  await getEduLockAdminDb().ref().update(updates);
  await writeEduLockAuditEvent(profile, {
    type: "edulock.security.sessions_revoked_by_classes",
    message: `Sesi aktif dicabut untuk ${targets.length} siswa berdasarkan kelas.`,
    schoolId,
    metadata: { count: targets.length, classKeys: Array.from(classKeys).join(",") },
  });
  return { count: targets.length };
}

async function setUninstallAuthorization(payload: EduLockSecurityPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  normalizeSchoolId(profile, payload.schoolId);
  const nisn = normalizeText(payload.nisn);
  if (!nisn) {
    throw new Error("NISN tidak valid.");
  }

  const studentSnapshot = await getEduLockAdminDb().ref(`students/${nisn}`).get();
  if (!studentSnapshot.exists()) {
    throw new Error("Data siswa tidak ditemukan.");
  }
  const student = studentSnapshot.val() || {};
  if (profile.role === "admin" && normalizeText(student.schoolId).toLowerCase() !== profile.schoolId.toLowerCase()) {
    throw new Error("Siswa berada di luar tenant admin aktif.");
  }

  await getEduLockAdminDb().ref(`students/${nisn}`).update({
    uninstall_authorized: Boolean(payload.isAuthorized),
  });
  await writeEduLockAuditEvent(profile, {
    type: "edulock.security.uninstall_authorization_changed",
    message: `Izin uninstall siswa ${nisn} ${payload.isAuthorized ? "diaktifkan" : "dicabut"}.`,
    schoolId: normalizeText(student.schoolId).toLowerCase(),
    targetId: nisn,
    metadata: { isAuthorized: Boolean(payload.isAuthorized) },
  });
}

async function bulkGrade9UninstallAuthorization(payload: EduLockSecurityPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const schoolId = normalizeSchoolId(profile, payload.schoolId);
  const students = await getStudentsBySchool(schoolId);
  const targets = students.filter((student) => isGrade9Class(student.className));
  if (targets.length === 0) {
    return { count: 0 };
  }

  const updates: Record<string, any> = {};
  for (const student of targets) {
    updates[`students/${student.nisn}/uninstall_authorized`] = Boolean(payload.isAuthorized);
  }
  await getEduLockAdminDb().ref().update(updates);
  await writeEduLockAuditEvent(profile, {
    type: "edulock.security.grade9_uninstall_authorization_changed",
    message: `Izin uninstall massal kelas 9 ${payload.isAuthorized ? "diaktifkan" : "dicabut"} untuk ${targets.length} siswa.`,
    schoolId,
    metadata: { count: targets.length, isAuthorized: Boolean(payload.isAuthorized) },
  });
  return { count: targets.length };
}

async function saveSchoolConfig(payload: EduLockSecurityPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const schoolId = normalizeSchoolId(profile, payload.schoolId);
  const config = payload.config || {};
  const nextConfig = {
    latitude: normalizeText(config.latitude),
    longitude: normalizeText(config.longitude),
    radius: Number(config.radius || 100),
    startTime: normalizeText(config.startTime || "07:00"),
    endTime: normalizeText(config.endTime || "14:00"),
    is_holiday_mode: Boolean(config.is_holiday_mode),
    is_active_protection: config.is_active_protection !== false,
    updatedAt: Date.now(),
  };

  await getEduLockAdminDb().ref(`schools/${schoolId}/config`).set(nextConfig);
  await writeEduLockAuditEvent(profile, {
    type: "edulock.security.school_config_saved",
    message: "Konfigurasi proteksi sekolah diperbarui.",
    schoolId,
    metadata: { radius: nextConfig.radius, startTime: nextConfig.startTime, endTime: nextConfig.endTime },
  });
}

async function saveGpsPolicy(payload: EduLockSecurityPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const schoolId = normalizeSchoolId(profile, payload.schoolId);
  const warnMin = Number(payload.gpsWarnMinutes);
  const lockMin = Number(payload.gpsLockMinutes);
  if (!Number.isFinite(warnMin) || warnMin < 0) {
    throw new Error("Peringatan GPS (menit) tidak valid.");
  }
  if (!Number.isFinite(lockMin) || lockMin < 0) {
    throw new Error("Lockdown GPS (menit) tidak valid.");
  }
  if (lockMin > 0 && warnMin > lockMin) {
    throw new Error("Peringatan GPS harus <= Lockdown GPS.");
  }

  await getEduLockAdminDb().ref(`schools/${schoolId}/policy`).update({
    gps_off_warn_ms: Math.round(warnMin * 60 * 1000),
    gps_off_lock_ms: Math.round(lockMin * 60 * 1000),
    updatedAt: Date.now(),
  });
  await writeEduLockAuditEvent(profile, {
    type: "edulock.security.gps_policy_saved",
    message: "Kebijakan GPS sekolah diperbarui.",
    schoolId,
    metadata: { gpsWarnMinutes: warnMin, gpsLockMinutes: lockMin },
  });
}

async function setConfigFlag(payload: EduLockSecurityPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const schoolId = normalizeSchoolId(profile, payload.schoolId);
  if (payload.flag !== "is_active_protection" && payload.flag !== "is_holiday_mode") {
    throw new Error("Flag konfigurasi tidak valid.");
  }

  await getEduLockAdminDb().ref(`schools/${schoolId}/config/${payload.flag}`).set(Boolean(payload.value));
  await writeEduLockAuditEvent(profile, {
    type: "edulock.security.config_flag_changed",
    message: `Flag ${payload.flag} diubah menjadi ${Boolean(payload.value)}.`,
    schoolId,
    metadata: { flag: payload.flag || "", value: Boolean(payload.value) },
  });
}

async function saveClass(payload: EduLockSecurityPayload, authorizationHeader?: string | null) {
  await requireEduLockAdminProfile(authorizationHeader);
  const className = normalizeText(payload.className);
  throw new Error(
    `Tambah kelas ${className || ""} wajib melalui jalur induk DATABASE/admin/students?sub=classes agar master_classes dan mirror EduLock tetap sinkron.`
  );
}

async function deleteClass(payload: EduLockSecurityPayload, authorizationHeader?: string | null) {
  await requireEduLockAdminProfile(authorizationHeader);
  const className = normalizeText(payload.className);
  throw new Error(
    `Hapus kelas ${className || ""} wajib melalui jalur induk DATABASE/admin/students?sub=classes agar master_classes dan mirror EduLock tetap sinkron.`
  );
}

async function saveWeekdaySchedule(payload: EduLockSecurityPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const schoolId = normalizeSchoolId(profile, payload.schoolId);
  const schedule = payload.weekdaySchedule || {};
  const allowedDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const updates: Record<string, any> = {};

  for (const day of allowedDays) {
    const row = schedule[day] || {};
    const start = normalizeText(row.start || "07:00");
    const end = normalizeText(row.end || "14:00");
    const startMin = parseMinutes(start);
    const endMin = parseMinutes(end);
    if (row.enabled && (startMin === null || endMin === null || endMin <= startMin)) {
      throw new Error(`Jam tidak valid untuk ${day}. Pastikan Jam Pulang > Jam Masuk.`);
    }
    updates[`schools/${schoolId}/schedule/weekdays/${day}`] = {
      enabled: Boolean(row.enabled),
      start,
      end,
    };
  }

  updates[`schools/${schoolId}/schedule/updatedAt`] = Date.now();
  await getEduLockAdminDb().ref().update(updates);
  await writeEduLockAuditEvent(profile, {
    type: "edulock.admin.weekday_schedule_saved",
    message: "Jadwal mingguan sekolah diperbarui.",
    schoolId,
  });
}

async function saveHoliday(payload: EduLockSecurityPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const schoolId = normalizeSchoolId(profile, payload.schoolId);
  const date = normalizeText(payload.date);
  const note = normalizeText(payload.note);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Tanggal tidak valid. Gunakan format yyyy-mm-dd.");
  }
  if (!note) {
    throw new Error("Keterangan wajib diisi.");
  }

  const now = Date.now();
  const existing = await getEduLockAdminDb().ref(`schools/${schoolId}/holidays/${date}`).get();
  await getEduLockAdminDb().ref(`schools/${schoolId}/holidays/${date}`).set({
    date,
    note,
    createdAt: existing.exists() ? existing.val()?.createdAt || now : now,
    updatedAt: now,
  });
  await writeEduLockAuditEvent(profile, {
    type: "edulock.admin.holiday_saved",
    message: `Hari libur ${date} disimpan: ${note}.`,
    schoolId,
    targetId: date,
  });
}

async function deleteHoliday(payload: EduLockSecurityPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const schoolId = normalizeSchoolId(profile, payload.schoolId);
  const date = normalizeText(payload.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Tanggal tidak valid.");
  }

  await getEduLockAdminDb().ref(`schools/${schoolId}/holidays/${date}`).remove();
  await writeEduLockAuditEvent(profile, {
    type: "edulock.admin.holiday_deleted",
    message: `Hari libur ${date} dihapus.`,
    schoolId,
    targetId: date,
  });
}

async function resetStudentDevice(payload: EduLockSecurityPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const schoolId = normalizeSchoolId(profile, payload.schoolId);
  const nisn = normalizeText(payload.nisn);
  if (!nisn) {
    throw new Error("NISN tidak valid.");
  }

  await requireStudentInSchool(nisn, schoolId);
  await getEduLockAdminDb().ref(`students/${nisn}/device_uuid`).remove();
  await writeEduLockAuditEvent(profile, {
    type: "edulock.admin.student_device_reset",
    message: `Device siswa ${nisn} di-reset.`,
    schoolId,
    targetId: nisn,
  });
}

async function deleteStudent(payload: EduLockSecurityPayload, authorizationHeader?: string | null) {
  await requireEduLockAdminProfile(authorizationHeader);
  const nisn = normalizeText(payload.nisn);
  throw new Error(
    `Hapus siswa ${nisn || ""} wajib melalui jalur induk DATABASE/admin/students agar master_students dan mirror EduLock tetap sinkron.`
  );
}

async function importStudents(payload: EduLockSecurityPayload, authorizationHeader?: string | null) {
  await requireEduLockAdminProfile(authorizationHeader);
  throw new Error(
    "Tambah/import siswa wajib melalui jalur induk DATABASE/admin/students agar master_students dan mirror EduLock tetap sinkron."
  );
}

async function bulkDeleteStudents(payload: EduLockSecurityPayload, authorizationHeader?: string | null) {
  await requireEduLockAdminProfile(authorizationHeader);
  const keyword = normalizeText(payload.classKeyword);
  throw new Error(
    `Hapus massal siswa${keyword ? ` dengan kata kunci kelas "${keyword}"` : ""} wajib melalui jalur induk DATABASE/admin/students agar master_students dan mirror EduLock tetap sinkron.`
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EduLockSecurityPayload;
    if (body.action === "create-code") {
      const result = await createAccessCode(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Kode akses berhasil dibuat.", data: result });
    }
    if (body.action === "delete-expired-codes") {
      const result = await deleteExpiredCodes(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Kode expired berhasil diproses.", data: result });
    }
    if (body.action === "revoke-sessions-by-classes") {
      const result = await revokeSessionsByClasses(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Pencabutan sesi massal berhasil diproses.", data: result });
    }
    if (body.action === "bulk-grade9-uninstall-auth") {
      const result = await bulkGrade9UninstallAuthorization(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Izin uninstall massal berhasil diproses.", data: result });
    }
    if (body.action === "save-class") {
      await saveClass(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Kelas berhasil disimpan." });
    }
    if (body.action === "save-weekday-schedule") {
      await saveWeekdaySchedule(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Jadwal sekolah berhasil disimpan." });
    }
    if (body.action === "save-holiday") {
      await saveHoliday(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Hari libur berhasil disimpan." });
    }
    if (body.action === "import-students") {
      const result = await importStudents(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Import siswa berhasil diproses.", data: result });
    }
    if (body.action === "save-config") {
      await saveSchoolConfig(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Konfigurasi sekolah berhasil disimpan." });
    }
    if (body.action === "save-gps-policy") {
      await saveGpsPolicy(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Kebijakan GPS berhasil disimpan." });
    }
    if (body.action === "password-changed") {
      await markPasswordChanged(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Metadata password admin berhasil diperbarui." });
    }
    return NextResponse.json({ success: false, message: "Aksi keamanan EduLock tidak valid." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as EduLockSecurityPayload;
    if (body.action === "set-uninstall-auth") {
      await setUninstallAuthorization(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Izin uninstall siswa berhasil diperbarui." });
    }
    if (body.action === "set-config-flag") {
      await setConfigFlag(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Flag konfigurasi sekolah berhasil diperbarui." });
    }
    if (body.action === "reset-student-device") {
      await resetStudentDevice(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Device siswa berhasil di-reset." });
    }
    return NextResponse.json({ success: false, message: "Aksi keamanan EduLock tidak valid." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as EduLockSecurityPayload;
    if (body.action === "delete-code") {
      await deleteAccessCode(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Kode akses berhasil dihapus." });
    }
    if (body.action === "revoke-session") {
      await revokeSingleSession(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Sesi aktif berhasil dicabut." });
    }
    if (body.action === "delete-class") {
      await deleteClass(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Kelas berhasil dihapus." });
    }
    if (body.action === "delete-holiday") {
      await deleteHoliday(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Hari libur berhasil dihapus." });
    }
    if (body.action === "delete-student") {
      await deleteStudent(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Siswa berhasil dihapus." });
    }
    if (body.action === "bulk-delete-students") {
      const result = await bulkDeleteStudents(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Hapus siswa massal berhasil diproses.", data: result });
    }
    return NextResponse.json({ success: false, message: "Aksi keamanan EduLock tidak valid." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}
