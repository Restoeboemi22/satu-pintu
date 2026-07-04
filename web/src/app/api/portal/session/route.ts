import { NextRequest, NextResponse } from "next/server";
import { getGasAdminDb } from "@/lib/server/firebaseAdmin";
import { requireEduLockAdminProfile } from "@/lib/server/edulockAuth";
import {
  buildClearPortalSessionCookie,
  buildPortalSessionCookie,
  buildPortalSessionUser,
  createPortalSessionToken,
  getPortalSessionFromRequest,
  type PortalSessionUser,
} from "@/lib/server/portalSession";

type PortalSessionPayload = {
  action?: "teacher-login" | "student-login" | "admin-sync";
  username?: string;
  password?: string;
  name?: string;
  email?: string;
};

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeLower(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeName(value: unknown) {
  return normalizeLower(value).replace(/\s+/g, " ");
}

function isAndroidClient(request: NextRequest) {
  return normalizeLower(request.headers.get("x-portal-client")) === "android";
}

function buildResponseWithSession(user: PortalSessionUser) {
  const sessionUser = buildPortalSessionUser(user);
  const token = createPortalSessionToken(sessionUser);
  const response = NextResponse.json({
    success: true,
    message: "Sesi Portal berhasil disiapkan.",
    data: { user: sessionUser },
  });
  response.cookies.set(buildPortalSessionCookie(token));
  return response;
}

async function loginTeacher(payload: PortalSessionPayload) {
  const username = normalizeName(payload.username);
  const password = normalizeText(payload.password);
  if (!username || !password) {
    throw new Error("Nama Guru/Wali Kelas dan NUPTK wajib diisi.");
  }

  const snapshot = await getGasAdminDb().ref(`master_teachers/${password}`).get();
  if (!snapshot.exists()) {
    throw new Error("Akun guru tidak ditemukan.");
  }
  const teacher = snapshot.val() || {};
  const teacherName = normalizeName(teacher.name);
  const schoolId = normalizeLower(teacher.schoolId);
  const status = normalizeLower(teacher.status);

  if (!teacherName || teacherName !== username) {
    throw new Error("Nama Guru/Wali Kelas atau NUPTK tidak cocok.");
  }
  if (!schoolId) {
    throw new Error("Akun guru belum terikat ke sekolah yang valid.");
  }
  if (status === "inactive" || status === "nonaktif") {
    throw new Error("Akun guru sedang nonaktif.");
  }

  return {
    id: normalizeText(teacher.nuptk || password),
    name: normalizeText(teacher.name),
    email: normalizeText(teacher.email),
    role: "teacher" as const,
    schoolId,
    schoolName: normalizeText(teacher.schoolName),
    npsn: normalizeText(teacher.npsn),
    class: normalizeText(teacher.homeroomClass || teacher.class),
    nuptk: normalizeText(teacher.nuptk || password),
  };
}

async function loginStudent(payload: PortalSessionPayload) {
  const username = normalizeName(payload.username);
  const password = normalizeText(payload.password);
  if (!username || !password) {
    throw new Error("Nama Siswa dan NISN wajib diisi.");
  }

  const snapshot = await getGasAdminDb().ref(`master_students/${password}`).get();
  if (!snapshot.exists()) {
    throw new Error("Akun siswa tidak ditemukan.");
  }
  const student = snapshot.val() || {};
  const studentName = normalizeName(student.name);
  const schoolId = normalizeLower(student.schoolId);
  const status = normalizeLower(student.status);

  if (!studentName || studentName !== username) {
    throw new Error("Nama Siswa atau NISN tidak cocok.");
  }
  if (!schoolId) {
    throw new Error("Akun siswa belum terikat ke sekolah yang valid.");
  }
  if (status === "inactive" || status === "nonaktif" || status === "graduated" || status === "transferred") {
    throw new Error("Akun siswa tidak aktif untuk login portal.");
  }

  return {
    id: normalizeText(student.nisn || password),
    name: normalizeText(student.name),
    email: normalizeText(student.email),
    role: "student" as const,
    schoolId,
    schoolName: normalizeText(student.schoolName),
    npsn: normalizeText(student.npsn),
    class: normalizeText(student.class),
    nisn: normalizeText(student.nisn || password),
  };
}

async function syncAdminSession(request: NextRequest, payload: PortalSessionPayload) {
  const profile = await requireEduLockAdminProfile(request.headers.get("authorization"));
  return {
    id: normalizeText(profile.uid),
    name:
      normalizeText(payload.name) ||
      (profile.role === "super_admin" ? "Super Admin PortalKita" : normalizeText(profile.schoolName) || "Admin Sekolah"),
    email: normalizeText(payload.email) || normalizeText(profile.email),
    role: profile.role === "super_admin" ? "super_admin" : "admin",
    schoolId: normalizeLower(profile.schoolId),
    schoolName: normalizeText(profile.schoolName),
    npsn: normalizeText(profile.npsn),
  } satisfies PortalSessionUser;
}

export async function GET() {
  try {
    const session = getPortalSessionFromRequest();
    if (!session) {
      return NextResponse.json({ success: false, message: "Sesi Portal tidak aktif." }, { status: 401 });
    }
    return NextResponse.json({ success: true, data: { user: session.user } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: String(error?.message || error) },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PortalSessionPayload;
    // Jalur teacher/student tetap dipertahankan untuk konsumsi APK Android.
    // Web PortalKita tidak lagi menampilkan halaman login guru/siswa.
    if (body.action === "teacher-login") {
      if (!isAndroidClient(request)) {
        return NextResponse.json(
          { success: false, message: "Login guru di web tidak diizinkan. Gunakan jalur admin web atau client Android resmi." },
          { status: 403 }
        );
      }
      const user = await loginTeacher(body);
      return buildResponseWithSession(user);
    }
    if (body.action === "student-login") {
      if (!isAndroidClient(request)) {
        return NextResponse.json(
          { success: false, message: "Login siswa di web tidak diizinkan. Gunakan client Android resmi." },
          { status: 403 }
        );
      }
      const user = await loginStudent(body);
      return buildResponseWithSession(user);
    }
    if (body.action === "admin-sync") {
      const user = await syncAdminSession(request, body);
      return buildResponseWithSession(user);
    }

    return NextResponse.json(
      { success: false, message: "Aksi sesi Portal tidak valid." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: String(error?.message || error) },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (request.headers.get("x-portal-logout") !== "1") {
    return NextResponse.json({ success: true, message: "Permintaan hapus sesi diabaikan." });
  }

  const response = NextResponse.json({ success: true, message: "Sesi Portal dihapus." });
  response.cookies.set(buildClearPortalSessionCookie());
  return response;
}
