import { NextRequest, NextResponse } from "next/server";
import { getGasAdminDb } from "@/lib/server/firebaseAdmin";
import { requirePortalSession } from "@/lib/server/portalSession";

type TeacherRubric = {
  honesty?: number;
  behavior?: number;
  initiative?: number;
  commitment?: number;
  total?: number;
};

type SevenHabitsPayload = {
  action?: "toggle-habit" | "set-teacher-rating";
  studentId?: string;
  date?: string;
  habitKey?: string;
  value?: boolean;
  month?: number;
  year?: number;
  rubric?: TeacherRubric;
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
    homeroomClass: normalizeText(teacher.class || teacher.homeroomClass),
  };
}

async function getStudentContext(studentId: string, schoolId: string) {
  const snapshot = await getGasAdminDb().ref(`master_students/${studentId}`).get();
  if (!snapshot.exists()) throw new Error("Siswa 7 KAIH tidak ditemukan.");
  const student = snapshot.val() || {};
  if (normalizeSchoolId(student.schoolId) !== schoolId) {
    throw new Error("Siswa berada di luar sekolah aktif.");
  }
  return {
    className: normalizeText(student.class),
  };
}

async function toggleHabit(payload: SevenHabitsPayload) {
  const session = requirePortalSession(["student"]);
  const schoolId = normalizeSchoolId(session.user.schoolId);
  const studentId = normalizeText(payload.studentId);
  const date = normalizeText(payload.date);
  const habitKey = normalizeText(payload.habitKey);
  const sessionStudentId = normalizeText(session.user.nisn || session.user.id);
  if (!studentId || !date || !habitKey) {
    throw new Error("studentId, date, dan habitKey wajib diisi.");
  }
  if (studentId !== sessionStudentId) {
    throw new Error("Siswa hanya boleh mengubah checklist miliknya sendiri.");
  }

  await getStudentContext(studentId, schoolId);
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
    schoolId,
    timestamp: Date.now(),
  });
}

async function setTeacherRating(payload: SevenHabitsPayload) {
  const session = requirePortalSession(["teacher"]);
  const schoolId = normalizeSchoolId(session.user.schoolId);
  const teacher = await getTeacherContext(session.user.nuptk || session.user.id, schoolId);

  const studentId = normalizeText(payload.studentId);
  const month = Number(payload.month);
  const year = Number(payload.year);
  if (!studentId || !Number.isFinite(month) || !Number.isFinite(year)) {
    throw new Error("studentId, month, dan year wajib diisi.");
  }

  const student = await getStudentContext(studentId, schoolId);
  if (teacher.homeroomClass && student.className && teacher.homeroomClass !== student.className) {
    throw new Error("Guru hanya boleh memberi nilai untuk kelas yang diampu.");
  }

  const key = `${studentId}_${month}_${year}`;
  const rubric = payload.rubric || {};
  await getGasAdminDb()
    .ref(`seven_habits_teacher_ratings/${schoolId}/${key}`)
    .set({
      honesty: Number(rubric.honesty || 0),
      behavior: Number(rubric.behavior || 0),
      initiative: Number(rubric.initiative || 0),
      commitment: Number(rubric.commitment || 0),
      total: Number(rubric.total || 0),
    });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SevenHabitsPayload;
    if (body.action === "toggle-habit") {
      await toggleHabit(body);
      return NextResponse.json({ success: true, message: "Checklist 7 KAIH berhasil disimpan." });
    }
    if (body.action === "set-teacher-rating") {
      await setTeacherRating(body);
      return NextResponse.json({ success: true, message: "Nilai 7 KAIH berhasil disimpan." });
    }

    return NextResponse.json(
      { success: false, message: "Aksi 7 KAIH portal tidak valid." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: String(error?.message || error) },
      { status: 400 }
    );
  }
}
