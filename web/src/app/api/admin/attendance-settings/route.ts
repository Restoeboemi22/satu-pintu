import { NextRequest, NextResponse } from "next/server";
import { getEduLockAdminDb, getGasAdminDb } from "@/lib/server/firebaseAdmin";
import { enforceAdminCapability } from "@/lib/server/adminPolicy";
import { writeEduLockAuditEvent } from "@/lib/server/edulockAudit";

type DailySchedulePayload = {
  dayId?: number;
  dayName?: string;
  isEnabled?: boolean;
  entryTime?: string;
  exitTime?: string;
};

type SchoolLocationPayload = {
  latitude?: number;
  longitude?: number;
  radius?: number;
};

type HolidayPayload = {
  id?: string;
  date?: string;
  description?: string;
};

type AttendanceSettingsPayload = {
  action?:
    | "save-attendance-schedules"
    | "save-prayer-schedules"
    | "save-school-location"
    | "save-musholla-location"
    | "add-holiday"
    | "remove-holiday";
  schoolId?: string;
  schedules?: DailySchedulePayload[];
  location?: SchoolLocationPayload;
  holiday?: HolidayPayload;
};

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSchoolScope(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function parseTime(value: unknown) {
  const raw = normalizeText(value);
  if (!/^\d{2}:\d{2}$/.test(raw)) {
    throw new Error("Format jam harus HH:MM.");
  }
  return raw;
}

function sanitizeSchedules(schedules: DailySchedulePayload[] | undefined) {
  if (!Array.isArray(schedules) || schedules.length === 0) {
    throw new Error("Daftar jadwal wajib diisi.");
  }

  return schedules.map((schedule) => {
    const dayId = Number(schedule?.dayId);
    if (!Number.isInteger(dayId) || dayId < 0 || dayId > 6) {
      throw new Error("dayId jadwal tidak valid.");
    }

    return {
      dayId,
      dayName: normalizeText(schedule?.dayName) || `Hari ${dayId}`,
      isEnabled: schedule?.isEnabled !== false,
      entryTime: parseTime(schedule?.entryTime),
      exitTime: parseTime(schedule?.exitTime),
    };
  });
}

function mapAttendanceDayIdToEduLockKey(dayId: number) {
  switch (dayId) {
    case 0:
      return "sun";
    case 1:
      return "mon";
    case 2:
      return "tue";
    case 3:
      return "wed";
    case 4:
      return "thu";
    case 5:
      return "fri";
    case 6:
      return "sat";
    default:
      throw new Error("dayId jadwal tidak valid.");
  }
}

function sanitizeLocation(location?: SchoolLocationPayload) {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  const radius = Number(location?.radius);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(radius)) {
    throw new Error("Koordinat tidak valid. Pastikan Latitude/Longitude/Radius berisi angka.");
  }
  return { latitude, longitude, radius };
}

async function saveAttendanceSchedules(payload: AttendanceSettingsPayload, authorizationHeader?: string | null) {
  const context = await enforceAdminCapability(authorizationHeader, "attendance.settings.write", {
    requestedSchoolId: payload.schoolId,
  });
  const { profile, schoolId } = context;
  const schedules = sanitizeSchedules(payload.schedules);
  const updates: Record<string, any> = {};

  schedules.forEach((schedule) => {
    const androidDayKey = schedule.dayId + 1;
    updates[`school_settings/${schoolId}/attendance/schedules/${androidDayKey}`] = {
      dayName: schedule.dayName,
      startTime: schedule.entryTime,
      endTime: schedule.exitTime,
      isHoliday: !schedule.isEnabled,
    };
  });

  await getGasAdminDb().ref().update(updates);

  const eduLockWeekdays: Record<string, { enabled: boolean; start: string; end: string }> = {};
  schedules.forEach((schedule) => {
    eduLockWeekdays[mapAttendanceDayIdToEduLockKey(schedule.dayId)] = {
      enabled: schedule.isEnabled !== false,
      start: schedule.entryTime,
      end: schedule.exitTime,
    };
  });
  await getEduLockAdminDb().ref(`schools/${schoolId}/schedule/weekdays`).set(eduLockWeekdays);

  await writeEduLockAuditEvent(profile, {
    type: "ATTENDANCE_SCHEDULE_SAVE",
    message: `Jadwal presensi sekolah ${schoolId} diperbarui.`,
    schoolId,
    metadata: { count: schedules.length },
  });
}

async function savePrayerSchedules(payload: AttendanceSettingsPayload, authorizationHeader?: string | null) {
  const context = await enforceAdminCapability(authorizationHeader, "attendance.settings.write", {
    requestedSchoolId: payload.schoolId,
  });
  const { profile, schoolId } = context;
  const schedules = sanitizeSchedules(payload.schedules);
  const updates: Record<string, any> = {};

  schedules.forEach((schedule) => {
    const androidDayKey = schedule.dayId + 1;
    updates[`school_settings/${schoolId}/prayer/schedules/${androidDayKey}`] = {
      dayName: schedule.dayName,
      startTime: schedule.entryTime,
      endTime: schedule.exitTime,
      isHoliday: !schedule.isEnabled,
    };
  });

  await getGasAdminDb().ref().update(updates);
  await writeEduLockAuditEvent(profile, {
    type: "PRAYER_SCHEDULE_SAVE",
    message: `Jadwal presensi sholat sekolah ${schoolId} diperbarui.`,
    schoolId,
    metadata: { count: schedules.length },
  });
}

async function saveSchoolLocation(payload: AttendanceSettingsPayload, authorizationHeader?: string | null) {
  const context = await enforceAdminCapability(authorizationHeader, "attendance.settings.write", {
    requestedSchoolId: payload.schoolId,
  });
  const { profile, schoolId } = context;
  const location = sanitizeLocation(payload.location);

  await getGasAdminDb().ref(`school_settings/${schoolId}/attendance/school_location`).update(location);
  await getEduLockAdminDb().ref(`schools/${schoolId}/config`).update({
    latitude: location.latitude,
    longitude: location.longitude,
    radius: location.radius,
    updatedAt: Date.now(),
    locationSource: "gas_attendance_school_location",
  });
  await writeEduLockAuditEvent(profile, {
    type: "ATTENDANCE_LOCATION_SAVE",
    message: `Lokasi sekolah untuk presensi diperbarui.`,
    schoolId,
    metadata: location,
  });
}

async function saveMushollaLocation(payload: AttendanceSettingsPayload, authorizationHeader?: string | null) {
  const context = await enforceAdminCapability(authorizationHeader, "attendance.settings.write", {
    requestedSchoolId: payload.schoolId,
  });
  const { profile, schoolId } = context;
  const location = sanitizeLocation(payload.location);

  await getGasAdminDb().ref(`school_settings/${schoolId}/prayer/musholla_location`).update(location);
  await writeEduLockAuditEvent(profile, {
    type: "PRAYER_LOCATION_SAVE",
    message: `Lokasi musholla untuk presensi sholat diperbarui.`,
    schoolId,
    metadata: location,
  });
}

async function addHoliday(payload: AttendanceSettingsPayload, authorizationHeader?: string | null) {
  const context = await enforceAdminCapability(authorizationHeader, "attendance.settings.write", {
    requestedSchoolId: payload.schoolId,
  });
  const { profile, schoolId } = context;
  const date = normalizeText(payload.holiday?.date);
  const description = normalizeText(payload.holiday?.description);
  if (!date || !description) {
    throw new Error("Tanggal dan keterangan hari libur wajib diisi.");
  }

  const holidayRef = getGasAdminDb().ref(`school_settings/${schoolId}/attendance/holidays`).push();
  await holidayRef.set({ date, description });
  await getEduLockAdminDb().ref(`schools/${schoolId}/holidays/${date}`).set({
    date,
    note: description,
    createdAt: Date.now(),
  });
  await writeEduLockAuditEvent(profile, {
    type: "ATTENDANCE_HOLIDAY_ADD",
    message: `Hari libur ${date} ditambahkan.`,
    schoolId,
    targetId: holidayRef.key || undefined,
    metadata: { date, description },
  });

  return { id: holidayRef.key || "" };
}

async function removeHoliday(payload: AttendanceSettingsPayload, authorizationHeader?: string | null) {
  const context = await enforceAdminCapability(authorizationHeader, "attendance.settings.write", {
    requestedSchoolId: payload.schoolId,
  });
  const { profile, schoolId } = context;
  const holidayId = normalizeText(payload.holiday?.id);
  if (!holidayId) {
    throw new Error("ID hari libur tidak valid.");
  }

  const holidaySnapshot = await getGasAdminDb().ref(`school_settings/${schoolId}/attendance/holidays/${holidayId}`).get();
  const holiday = holidaySnapshot.exists() ? holidaySnapshot.val() || {} : {};
  const holidayDate = normalizeText(holiday?.date);

  await getGasAdminDb().ref(`school_settings/${schoolId}/attendance/holidays/${holidayId}`).remove();
  if (holidayDate) {
    await getEduLockAdminDb().ref(`schools/${schoolId}/holidays/${holidayDate}`).remove();
  }
  await writeEduLockAuditEvent(profile, {
    type: "ATTENDANCE_HOLIDAY_REMOVE",
    message: `Hari libur ${holidayId} dihapus.`,
    schoolId,
    targetId: holidayId,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AttendanceSettingsPayload;
    if (body.action === "save-attendance-schedules") {
      await saveAttendanceSchedules(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Jadwal presensi berhasil disimpan." });
    }
    if (body.action === "save-prayer-schedules") {
      await savePrayerSchedules(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Jadwal sholat berhasil disimpan." });
    }
    if (body.action === "save-school-location") {
      await saveSchoolLocation(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Lokasi sekolah berhasil disimpan." });
    }
    if (body.action === "save-musholla-location") {
      await saveMushollaLocation(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Lokasi musholla berhasil disimpan." });
    }
    if (body.action === "add-holiday") {
      const result = await addHoliday(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Hari libur berhasil ditambahkan.", data: result });
    }
    return NextResponse.json({ success: false, message: "Aksi attendance settings tidak valid." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as AttendanceSettingsPayload;
    if (body.action !== "remove-holiday") {
      return NextResponse.json({ success: false, message: "Aksi attendance settings tidak valid." }, { status: 400 });
    }

    await removeHoliday(body, request.headers.get("authorization"));
    return NextResponse.json({ success: true, message: "Hari libur berhasil dihapus." });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}
