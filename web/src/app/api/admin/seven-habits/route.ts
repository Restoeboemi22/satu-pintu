import { NextRequest, NextResponse } from "next/server";
import { getGasAdminDb } from "@/lib/server/firebaseAdmin";
import { enforceAdminCapability } from "@/lib/server/adminPolicy";
import { writeEduLockAuditEvent } from "@/lib/server/edulockAudit";

type TeacherRubric = {
  honesty?: number;
  behavior?: number;
  initiative?: number;
  commitment?: number;
  total?: number;
};

type SevenHabitsPayload = {
  action?: "toggle-habit" | "set-teacher-rating";
  schoolId?: string;
  studentId?: string;
  date?: string;
  habitKey?: string;
  value?: boolean;
  month?: number;
  year?: number;
  rubric?: TeacherRubric;
};

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSchoolId(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

async function assertStudentScope(studentId: string, schoolId: string) {
  const snapshot = await getGasAdminDb().ref(`master_students/${studentId}`).get();
  if (!snapshot.exists()) {
    throw new Error("Siswa 7 KAIH tidak ditemukan di database inti.");
  }
  const school = normalizeSchoolId(snapshot.val()?.schoolId);
  if (school !== schoolId) {
    throw new Error("Siswa 7 KAIH berada di sekolah lain.");
  }
}

async function toggleHabit(payload: SevenHabitsPayload, authorizationHeader?: string | null) {
  const context = await enforceAdminCapability(authorizationHeader, "seven-habits.write", {
    requestedSchoolId: normalizeSchoolId(payload.schoolId),
  });
  const studentId = normalizeText(payload.studentId);
  const date = normalizeText(payload.date);
  const habitKey = normalizeText(payload.habitKey);
  if (!studentId || !date || !habitKey) {
    throw new Error("studentId, date, dan habitKey wajib diisi.");
  }
  await assertStudentScope(studentId, context.schoolId);

  const logRef = getGasAdminDb().ref(`seven_habits_logs/${studentId}/${date}`);
  const snapshot = await logRef.get();
  const existing = snapshot.exists() ? snapshot.val() || {} : {};
  const [year, month, day] = date.split("-").map(Number);
  const habits = {
    habit1: Boolean(existing?.habits?.habit1 || existing?.habit1),
    habit2: Boolean(existing?.habits?.habit2 || existing?.habit2),
    habit3: Boolean(existing?.habits?.habit3 || existing?.habit3),
    habit4: Boolean(existing?.habits?.habit4 || existing?.habit4),
    habit5: Boolean(existing?.habits?.habit5 || existing?.habit5),
    habit6: Boolean(existing?.habits?.habit6 || existing?.habit6),
    habit7: Boolean(existing?.habits?.habit7 || existing?.habit7),
    [habitKey]: payload.value === true,
  };

  await logRef.set({
    ...existing,
    id: existing?.id || `habit_${studentId}_${date}`,
    studentId,
    date,
    week: Number.isFinite(day) ? Math.ceil(day / 7) : 1,
    month,
    year,
    habits,
    schoolId: context.schoolId,
    timestamp: Date.now(),
  });

  await writeEduLockAuditEvent(context.profile, {
    type: "SEVEN_HABITS_TOGGLE",
    message: `Mengubah checklist 7 KAIH ${habitKey} untuk siswa ${studentId}.`,
    schoolId: context.schoolId,
    targetId: `${studentId}_${date}`,
    metadata: { habitKey, value: payload.value === true },
  });
}

async function setTeacherRating(payload: SevenHabitsPayload, authorizationHeader?: string | null) {
  const context = await enforceAdminCapability(authorizationHeader, "seven-habits.write", {
    requestedSchoolId: normalizeSchoolId(payload.schoolId),
  });
  const studentId = normalizeText(payload.studentId);
  const month = Number(payload.month);
  const year = Number(payload.year);
  if (!studentId || !Number.isFinite(month) || !Number.isFinite(year)) {
    throw new Error("studentId, month, dan year wajib diisi.");
  }
  await assertStudentScope(studentId, context.schoolId);

  const key = `${studentId}_${month}_${year}`;
  const rubric = payload.rubric || {};
  await getGasAdminDb()
    .ref(`seven_habits_teacher_ratings/${context.schoolId}/${key}`)
    .set({
      honesty: Number(rubric.honesty || 0),
      behavior: Number(rubric.behavior || 0),
      initiative: Number(rubric.initiative || 0),
      commitment: Number(rubric.commitment || 0),
      total: Number(rubric.total || 0),
    });

  await writeEduLockAuditEvent(context.profile, {
    type: "SEVEN_HABITS_RATING_SET",
    message: `Menyimpan nilai guru 7 KAIH untuk siswa ${studentId}.`,
    schoolId: context.schoolId,
    targetId: key,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SevenHabitsPayload;
    const authorizationHeader = request.headers.get("authorization");
    if (body.action === "toggle-habit") {
      await toggleHabit(body, authorizationHeader);
      return NextResponse.json({ success: true, message: "Checklist 7 KAIH berhasil disimpan." });
    }
    if (body.action === "set-teacher-rating") {
      await setTeacherRating(body, authorizationHeader);
      return NextResponse.json({ success: true, message: "Nilai guru 7 KAIH berhasil disimpan." });
    }

    return NextResponse.json(
      { success: false, message: "Aksi 7 KAIH admin tidak valid." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: String(error?.message || error) },
      { status: 400 }
    );
  }
}
