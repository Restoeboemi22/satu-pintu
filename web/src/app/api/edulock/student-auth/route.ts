import { NextRequest, NextResponse } from "next/server";
import { getEduLockAdminAuth, getEduLockAdminDb } from "@/lib/server/firebaseAdmin";

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeNisn(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, "");
}

function normalizeSchoolId(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizeName(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

type StudentAuthPayload = {
  npsn?: string;
  nisn?: string;
  name?: string;
  deviceId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as StudentAuthPayload;
    const npsn = normalizeText(body.npsn);
    const nisn = normalizeNisn(body.nisn);
    const providedName = normalizeName(body.name);
    const deviceId = normalizeText(body.deviceId);

    if (!npsn || !nisn || !providedName) {
      throw new Error("Data siswa tidak lengkap.");
    }

    const db = getEduLockAdminDb();
    const schoolIdIndexSnap = await db.ref(`npsn_index/${npsn}`).get();
    const expectedSchoolId = normalizeSchoolId(schoolIdIndexSnap.val());
    if (!expectedSchoolId) {
      throw new Error("NPSN tidak ditemukan atau belum terdaftar.");
    }

    const schoolStudentSnap = await db.ref(`students_by_school/${expectedSchoolId}/${nisn}`).get();
    if (!schoolStudentSnap.exists()) {
      throw new Error("NISN tidak terdaftar pada sekolah ini.");
    }

    const studentSnap = await db.ref(`students/${nisn}`).get();
    if (!studentSnap.exists()) {
      throw new Error("NISN tidak terdaftar.");
    }

    const student = studentSnap.val() || {};
    const storedName = normalizeName(student?.name);
    const storedClass = normalizeText(student?.class);
    const schoolId = normalizeSchoolId(student?.schoolId);
    const schoolName = normalizeText(student?.schoolName);
    const status = normalizeText(student?.status).toLowerCase();

    if (!schoolId) {
      throw new Error("Data siswa belum memiliki tenant sekolah.");
    }
    if (schoolId != expectedSchoolId) {
      throw new Error("Data siswa tidak cocok dengan NPSN sekolah.");
    }

    if (status === "inactive" || status === "nonaktif") {
      throw new Error("Akun siswa nonaktif. Hubungi admin sekolah.");
    }

    if (storedName && storedName !== providedName) {
      throw new Error("Nama tidak sesuai database.");
    }

    const schoolSnap = await db.ref(`schools/${schoolId}`).get();
    if (schoolSnap.exists()) {
      const isActive = schoolSnap.child("isActive").val() !== false;
      const serviceActive = schoolSnap.child("serviceStatus").child("serviceActive").val() !== false;
      if (!isActive || !serviceActive) {
        throw new Error("Layanan sekolah nonaktif. Hubungi admin sekolah.");
      }
    }

    const existingDevice = normalizeText(student?.device_uuid);
    if (existingDevice && deviceId && existingDevice !== deviceId) {
      throw new Error("Akun sudah terikat di perangkat lain. Minta admin reset device.");
    }

    if (deviceId) {
      const bindingTx = await db.ref(`students/${nisn}/device_uuid`).transaction((current) => {
        const normalizedCurrent = normalizeText(current);
        if (!normalizedCurrent || normalizedCurrent === deviceId) {
          return deviceId;
        }
        return;
      });

      if (!bindingTx.committed) {
        throw new Error("Akun sudah terikat di perangkat lain. Minta admin reset device.");
      }

      const now = Date.now();
      await Promise.all([
        db.ref(`students/${nisn}`).update({
          device_uuid: deviceId,
          lastLoginAt: now,
          updatedAt: now,
        }),
        db.ref(`students_by_school/${schoolId}/${nisn}`).update({
          device_uuid: deviceId,
          lastLoginAt: now,
          updatedAt: now,
        }),
      ]);
    }

    const auth = getEduLockAdminAuth();
    const uid = `student_${nisn}`;
    const token = await auth.createCustomToken(uid, {
      role: "student",
      schoolId,
      nisn,
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        schoolId,
        schoolName,
        npsn,
        nisn,
        studentName: normalizeText(student?.name),
        className: storedClass,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}
