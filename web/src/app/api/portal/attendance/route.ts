import { NextRequest, NextResponse } from "next/server";
import { getGasAdminDb } from "@/lib/server/firebaseAdmin";
import { requirePortalSession } from "@/lib/server/portalSession";

type AttendancePayload = {
  action?: "upsert-manual-log";
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

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeSchoolId(value: unknown) {
  return normalizeText(value).toLowerCase();
}

async function getTeacherContext(teacherId: string, schoolId: string) {
  const snapshot = await getGasAdminDb().ref(`master_teachers/${teacherId}`).get();
  if (!snapshot.exists()) throw new Error("Akun guru tidak ditemukan.");
  const teacher = snapshot.val() || {};
  if (normalizeSchoolId(teacher.schoolId) !== schoolId) {
    throw new Error("Guru berada di luar sekolah aktif.");
  }
  const status = normalizeText(teacher.status).toLowerCase();
  if (status === "inactive" || status === "nonaktif") {
    throw new Error("Akun guru sedang nonaktif.");
  }
  return {
    name: normalizeText(teacher.name),
    homeroomClass: normalizeText(teacher.class || teacher.homeroomClass),
  };
}

async function getStudentContext(studentId: string, schoolId: string) {
  const snapshot = await getGasAdminDb().ref(`master_students/${studentId}`).get();
  if (!snapshot.exists()) throw new Error("Siswa presensi tidak ditemukan.");
  const student = snapshot.val() || {};
  if (normalizeSchoolId(student.schoolId) !== schoolId) {
    throw new Error("Siswa berada di sekolah lain.");
  }
  const status = normalizeText(student.status).toLowerCase();
  if (status === "inactive" || status === "nonaktif" || status === "graduated" || status === "transferred") {
    throw new Error("Siswa tidak aktif untuk presensi.");
  }
  return {
    name: normalizeText(student.name),
    className: normalizeText(student.class),
  };
}

async function upsertManualLog(payload: AttendancePayload) {
  const session = requirePortalSession(["teacher"]);
  const schoolId = normalizeSchoolId(session.user.schoolId);
  if (!schoolId) throw new Error("Sesi guru tidak memiliki schoolId yang valid.");

  const studentId = normalizeText(payload.log?.studentId);
  const status = payload.log?.status;
  const date = Number(payload.log?.date);
  if (!studentId || !status || !Number.isFinite(date)) {
    throw new Error("Data log presensi tidak lengkap.");
  }

  const teacher = await getTeacherContext(session.user.nuptk || session.user.id, schoolId);
  const student = await getStudentContext(studentId, schoolId);

  if (teacher.homeroomClass && student.className && teacher.homeroomClass !== student.className) {
    throw new Error("Guru hanya boleh input manual untuk kelas yang diampu.");
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
    studentName: student.name,
    schoolId,
    schoolName: normalizeText(session.user.schoolName),
    date,
    status,
    checkInTime: payload.log?.checkInTime ?? existing.checkInTime ?? null,
    checkOutTime: existing.checkOutTime ?? null,
    checkInMethod: normalizeText(payload.log?.checkInMethod) || existing.checkInMethod || "MANUAL_TEACHER",
    notes: payload.log?.notes ?? existing.notes ?? null,
    proofDocument: existing.proofDocument ?? null,
    recordedBy: teacher.name || normalizeText(payload.log?.recordedBy) || session.user.name,
    createdAt: Number(existing.createdAt || now),
    updatedAt: now,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AttendancePayload;
    if (body.action === "upsert-manual-log") {
      await upsertManualLog(body);
      return NextResponse.json({ success: true, message: "Log presensi manual berhasil disimpan." });
    }

    return NextResponse.json(
      { success: false, message: "Aksi attendance portal tidak valid." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: String(error?.message || error) },
      { status: 400 }
    );
  }
}
