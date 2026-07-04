import { NextRequest, NextResponse } from "next/server";
import { getGasAdminDb } from "@/lib/server/firebaseAdmin";
import { enforceAdminCapability } from "@/lib/server/adminPolicy";
import { writeEduLockAuditEvent } from "@/lib/server/edulockAudit";

type AttendanceLogPayload = {
  action?: "upsert-manual-log" | "delete-all";
  schoolId?: string;
  log?: {
    id?: string;
    studentId?: string;
    studentName?: string;
    date?: number;
    status?: "PRESENT" | "ABSENT" | "LATE" | "SICK" | "PERMIT";
    checkInTime?: string | null;
    checkInMethod?: string | null;
    notes?: string | null;
    recordedBy?: string | null;
  };
};

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSchoolId(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

async function getStudentMeta(studentId: string) {
  const snapshot = await getGasAdminDb().ref(`master_students/${studentId}`).get();
  if (!snapshot.exists()) {
    throw new Error("Siswa presensi tidak ditemukan di master_students.");
  }

  const value = snapshot.val() || {};
  return {
    schoolId: normalizeSchoolId(value.schoolId),
    schoolName: normalizeText(value.schoolName),
    name: normalizeText(value.name),
  };
}

async function upsertManualLog(payload: AttendanceLogPayload, authorizationHeader?: string | null) {
  const requestedSchoolId = normalizeSchoolId(payload.schoolId);
  const context = await enforceAdminCapability(
    authorizationHeader,
    "attendance.logs.write",
    { requestedSchoolId }
  );

  const studentId = normalizeText(payload.log?.studentId);
  const studentName = normalizeText(payload.log?.studentName);
  const status = payload.log?.status;
  const date = Number(payload.log?.date);
  if (!studentId || !studentName || !status || !Number.isFinite(date)) {
    throw new Error("Data log presensi tidak lengkap.");
  }

  const studentMeta = await getStudentMeta(studentId);
  if (studentMeta.schoolId !== context.schoolId) {
    throw new Error("Log presensi siswa ini berada di sekolah lain.");
  }

  const logsRef = getGasAdminDb().ref("attendance");
  const logId = normalizeText(payload.log?.id) || logsRef.push().key || `attendance_${Date.now()}`;
  const existingSnap = await logsRef.child(logId).get();
  const existing = existingSnap.exists() ? existingSnap.val() || {} : {};
  const now = Date.now();

  await logsRef.child(logId).set({
    ...existing,
    id: logId,
    studentId,
    studentName,
    schoolId: context.schoolId,
    schoolName: studentMeta.schoolName || context.profile.schoolName,
    date,
    status,
    checkInTime: payload.log?.checkInTime ?? existing.checkInTime ?? null,
    checkOutTime: existing.checkOutTime ?? null,
    checkInMethod: normalizeText(payload.log?.checkInMethod) || existing.checkInMethod || "MANUAL_TEACHER",
    notes: payload.log?.notes ?? existing.notes ?? null,
    proofDocument: existing.proofDocument ?? null,
    recordedBy: normalizeText(payload.log?.recordedBy) || context.profile.email,
    createdAt: Number(existing.createdAt || now),
    updatedAt: now,
  });

  await writeEduLockAuditEvent(context.profile, {
    type: existingSnap.exists() ? "ATTENDANCE_LOG_UPDATE" : "ATTENDANCE_LOG_CREATE",
    message: `${existingSnap.exists() ? "Memperbarui" : "Membuat"} log presensi manual untuk ${studentName}.`,
    schoolId: context.schoolId,
    targetId: logId,
    metadata: { studentId, status, date },
  });
}

async function deleteAllLogs(payload: AttendanceLogPayload, authorizationHeader?: string | null) {
  const requestedSchoolId = normalizeSchoolId(payload.schoolId);
  const context = await enforceAdminCapability(
    authorizationHeader,
    "attendance.logs.delete",
    { requestedSchoolId }
  );

  const studentsSnap = await getGasAdminDb()
    .ref("master_students")
    .orderByChild("schoolId")
    .equalTo(context.schoolId)
    .get();
  const studentIds = new Set<string>();
  if (studentsSnap.exists()) {
    Object.entries<any>(studentsSnap.val() || {}).forEach(([key, value]) => {
      studentIds.add(normalizeText(value?.nisn || key));
      studentIds.add(normalizeText(value?.id || ""));
    });
  }

  const attendanceSnap = await getGasAdminDb().ref("attendance").get();
  if (!attendanceSnap.exists()) return { removed: 0 };

  const updates: Record<string, null> = {};
  Object.entries<any>(attendanceSnap.val() || {}).forEach(([key, value]) => {
    const itemSchoolId = normalizeSchoolId(value?.schoolId);
    const itemStudentId = normalizeText(value?.studentId);
    if (itemSchoolId === context.schoolId || studentIds.has(itemStudentId)) {
      updates[key] = null;
    }
  });

  const removed = Object.keys(updates).length;
  if (removed > 0) {
    await getGasAdminDb().ref("attendance").update(updates);
  }

  await writeEduLockAuditEvent(context.profile, {
    type: "ATTENDANCE_LOGS_DELETE_ALL",
    message: `Menghapus ${removed} log presensi untuk sekolah ${context.schoolId}.`,
    schoolId: context.schoolId,
    metadata: { removed },
  });

  return { removed };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AttendanceLogPayload;
    if (body.action === "upsert-manual-log") {
      await upsertManualLog(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Log presensi berhasil disimpan." });
    }

    if (body.action === "delete-all") {
      const result = await deleteAllLogs(body, request.headers.get("authorization"));
      return NextResponse.json({
        success: true,
        message: `Log presensi berhasil dihapus (${result.removed}).`,
        data: result,
      });
    }

    return NextResponse.json(
      { success: false, message: "Aksi attendance logs tidak valid." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: String(error?.message || error) },
      { status: 400 }
    );
  }
}
