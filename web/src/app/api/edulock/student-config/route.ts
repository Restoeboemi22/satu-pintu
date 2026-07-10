import { NextRequest, NextResponse } from "next/server";
import { getEduLockAdminAuth, getEduLockAdminDb, getGasAdminDb } from "@/lib/server/firebaseAdmin";

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSchoolId(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizeIdentity(value: unknown): string {
  return normalizeText(value);
}

function resolveNisnFromToken(decoded: { nisn?: unknown; uid?: unknown }) {
  const direct = normalizeText(decoded.nisn);
  if (direct) return direct;

  const uid = normalizeText(decoded.uid);
  const match = uid.match(/^student_(.+)$/i);
  return normalizeText(match?.[1]);
}

function formatDateKeyWib(dateMs: number) {
  const wibShiftMs = 7 * 60 * 60 * 1000;
  const d = new Date(dateMs + wibShiftMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseFloat(normalizeText(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function readBearerToken(request: NextRequest): string {
  return normalizeText(request.headers.get("authorization")).replace(/^Bearer\s+/i, "");
}

async function resolveGasStudentAliases(schoolId: string, nisn: string) {
  const gasDb = getGasAdminDb();
  const [masterStudentSnap, legacyStudentSnap] = await Promise.all([
    gasDb.ref(`master_students/${nisn}`).get(),
    gasDb.ref(`students/${nisn}`).get(),
  ]);

  const identities = new Set<string>([nisn]);
  const schoolIds = new Set<string>();

  const collect = (value: any, fallbackKey?: string) => {
    if (!value) return;
    identities.add(normalizeIdentity(fallbackKey));
    identities.add(normalizeIdentity(value.nisn));
    identities.add(normalizeIdentity(value.id));
    identities.add(normalizeIdentity(value.studentId));
    identities.add(normalizeIdentity(value.username));
    identities.add(normalizeIdentity(value.loginKey));
    const itemSchoolId = normalizeSchoolId(value.schoolId);
    if (itemSchoolId) schoolIds.add(itemSchoolId);
  };

  if (masterStudentSnap.exists()) {
    collect(masterStudentSnap.val() || {}, masterStudentSnap.key || nisn);
  }
  if (legacyStudentSnap.exists()) {
    collect(legacyStudentSnap.val() || {}, legacyStudentSnap.key || nisn);
  }

  const aliases = Array.from(identities).map((item) => item.trim()).filter(Boolean);
  const isSchoolMatched = schoolIds.size === 0 || schoolIds.has(schoolId);
  return {
    aliases,
    isSchoolMatched,
  };
}

async function resolveTodayAttendanceFromGas(params: {
  schoolId: string;
  nisn: string;
  todayKey: string;
}) {
  const gasDb = getGasAdminDb();
  const aliasResult = await resolveGasStudentAliases(params.schoolId, params.nisn);
  const aliases = aliasResult.aliases.length > 0 ? aliasResult.aliases : [params.nisn];

  const [legacyAttendanceSnap, ...flatAttendanceSnaps] = await Promise.all([
    gasDb.ref(`students/${params.nisn}/daily_attendance/${params.todayKey}`).get(),
    ...aliases.map((alias) => gasDb.ref("attendance").orderByChild("studentId").equalTo(alias).get()),
  ]);

  const legacyValue = legacyAttendanceSnap.val() || {};
  const legacyStatus = normalizeText(legacyValue.status).toUpperCase();
  const legacyDate = Number(legacyValue.date || legacyValue.timestamp || 0);
  const legacyUpdatedAt = Number(legacyValue.updatedAt || legacyDate || 0);

  const flatRecords = flatAttendanceSnaps
    .flatMap((snap) => snap.children.map((child) => ({ key: child.key || "", value: child.val() || {} })))
    .map(({ key, value }) => {
      const status = normalizeText(value.status).toUpperCase();
      const schoolId = normalizeSchoolId(value.schoolId);
      const studentId = normalizeIdentity(value.studentId);
      const date = Number(value.date || 0);
      const updatedAt = Number(value.updatedAt || value.checkOutTime || value.checkInTime || date || 0);
      const checkInTime = value.checkInTime == null ? null : Number(value.checkInTime);
      const checkOutTime = value.checkOutTime == null ? null : Number(value.checkOutTime);
      if (!status || !Number.isFinite(date)) return null;
      if (schoolId && schoolId !== params.schoolId) return null;
      if (formatDateKeyWib(date) !== params.todayKey) return null;
      return {
        id: key,
        studentId,
        date,
        status,
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : date,
        checkInTime: Number.isFinite(checkInTime as number) ? checkInTime : null,
        checkOutTime: Number.isFinite(checkOutTime as number) ? checkOutTime : null,
      };
    })
    .filter(
      (
        item
      ): item is {
        id: string;
        studentId: string;
        date: number;
        status: string;
        updatedAt: number;
        checkInTime: number | null;
        checkOutTime: number | null;
      } => item !== null
    )
    .sort((a, b) => b.updatedAt - a.updatedAt || b.date - a.date);

  const latestFlat = flatRecords[0] || null;
  if (latestFlat) {
    return {
      dateKey: params.todayKey,
      status: latestFlat.status,
      source: "gas_attendance_flat",
      aliases,
      matchedStudentId: latestFlat.studentId,
      updatedAt: latestFlat.updatedAt,
      checkInTime: latestFlat.checkInTime,
      checkOutTime: latestFlat.checkOutTime,
      isSchoolMatched: aliasResult.isSchoolMatched,
    };
  }

  if (legacyStatus) {
    return {
      dateKey: params.todayKey,
      status: legacyStatus,
      source: "gas_legacy_daily_attendance",
      aliases,
      matchedStudentId: params.nisn,
      updatedAt: legacyUpdatedAt || Date.now(),
      checkInTime: null,
      checkOutTime: null,
      isSchoolMatched: aliasResult.isSchoolMatched,
    };
  }

  return {
    dateKey: params.todayKey,
    status: "",
    source: "unavailable",
    aliases,
    matchedStudentId: "",
    updatedAt: 0,
    checkInTime: null,
    checkOutTime: null,
    isSchoolMatched: aliasResult.isSchoolMatched,
  };
}

export async function GET(request: NextRequest) {
  try {
    const idToken = readBearerToken(request);
    if (!idToken) {
      throw new Error("Token siswa wajib dikirim.");
    }

    const decoded = await getEduLockAdminAuth().verifyIdToken(idToken);
    const schoolId = normalizeSchoolId(decoded.schoolId);
    const nisn = resolveNisnFromToken(decoded);
    const role = normalizeText(decoded.role).toLowerCase();
    if (!schoolId || !nisn || role !== "student") {
      throw new Error("Token siswa tidak valid.");
    }

    const todayKey = formatDateKeyWib(Date.now());

    const [eduConfigSnap, weekdaySnap, gasLocationSnap, attendanceToday] = await Promise.all([
      getEduLockAdminDb().ref(`schools/${schoolId}/config`).get(),
      getEduLockAdminDb().ref(`schools/${schoolId}/schedule/weekdays`).get(),
      getGasAdminDb().ref(`school_settings/${schoolId}/attendance/school_location`).get(),
      resolveTodayAttendanceFromGas({ schoolId, nisn, todayKey }),
    ]);

    const eduConfig = eduConfigSnap.val() || {};
    const gasLocation = gasLocationSnap.val() || {};
    const weekdaySchedule = weekdaySnap.val() || {};

    const latitude = normalizeNumber(gasLocation.latitude) ?? normalizeNumber(eduConfig.latitude);
    const longitude = normalizeNumber(gasLocation.longitude) ?? normalizeNumber(eduConfig.longitude);
    const radius = normalizeNumber(gasLocation.radius) ?? normalizeNumber(eduConfig.radius);

    return NextResponse.json({
      success: true,
      data: {
        nisn,
        schoolId,
        location: {
          latitude,
          longitude,
          radius,
          source: latitude != null && longitude != null
            ? (gasLocationSnap.exists() ? "gas_attendance_school_location" : normalizeText(eduConfig.locationSource) || "edulock_config")
            : "unavailable",
        },
        schedule: weekdaySchedule,
        attendanceToday: {
          dateKey: todayKey,
          status: attendanceToday.status,
          source: attendanceToday.source,
          updatedAt: attendanceToday.updatedAt,
          checkInTime: attendanceToday.checkInTime,
          checkOutTime: attendanceToday.checkOutTime,
        },
        configUpdatedAt: typeof eduConfig.updatedAt === "number" ? eduConfig.updatedAt : null,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: String(error?.message || error) },
      { status: 400 }
    );
  }
}
