import { NextRequest, NextResponse } from "next/server";
import { getGasAdminDb } from "@/lib/server/firebaseAdmin";
import { requireEduLockAdminProfile } from "@/lib/server/edulockAuth";
import { writeEduLockAuditEvent } from "@/lib/server/edulockAudit";

type PersonnelPayload = {
  entity: "teacher" | "staff" | "tatib";
  action?: "reset-device";
  nuptk?: string;
  nisn?: string;
  username?: string;
  name?: string;
  password?: string;
  className?: string;
  position?: string;
  status?: "Aktif" | "Nonaktif" | "";
  isActive?: boolean;
  schoolId?: string;
  schoolName?: string;
  npsn?: string;
};

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeStatus(value: unknown): "Aktif" | "Nonaktif" {
  return String(value || "") === "Nonaktif" ? "Nonaktif" : "Aktif";
}

function teacherStatusToLegacy(status: "Aktif" | "Nonaktif"): "active" | "inactive" {
  return status === "Nonaktif" ? "inactive" : "active";
}

function normalizeTatibUsername(value: unknown): string {
  return normalizeText(value).toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

async function getExistingTeacher(nuptk: string) {
  const snapshot = await getGasAdminDb().ref(`master_teachers/${nuptk}`).get();
  if (!snapshot.exists()) return null;
  return snapshot.val() || null;
}

async function getExistingStaff(nisn: string) {
  const snapshot = await getGasAdminDb().ref(`master_staff/${nisn}`).get();
  if (!snapshot.exists()) return null;
  return snapshot.val() || null;
}

async function getExistingStudent(nisn: string) {
  const snapshot = await getGasAdminDb().ref(`master_students/${nisn}`).get();
  if (!snapshot.exists()) return null;
  return snapshot.val() || null;
}

async function getExistingTatib(username: string) {
  const snapshot = await getGasAdminDb().ref(`staff/${username}`).get();
  if (!snapshot.exists()) return null;
  return snapshot.val() || null;
}

function resolveTenantContext(
  profile: Awaited<ReturnType<typeof requireEduLockAdminProfile>>,
  payload: PersonnelPayload,
  existingRecord?: any
) {
  const requestedSchoolId = normalizeText(payload.schoolId || existingRecord?.schoolId);
  const requestedSchoolName = normalizeText(payload.schoolName || existingRecord?.schoolName);
  const requestedNpsn = normalizeText(payload.npsn || existingRecord?.npsn);

  if (profile.role === "admin") {
    return {
      schoolId: profile.schoolId,
      schoolName: profile.schoolName || requestedSchoolName,
      npsn: profile.npsn || requestedNpsn,
    };
  }

  if (!requestedSchoolId) {
    throw new Error("schoolId wajib diisi untuk operasi super admin.");
  }

  return {
    schoolId: requestedSchoolId,
    schoolName: requestedSchoolName,
    npsn: requestedNpsn,
  };
}

async function createTeacher(payload: PersonnelPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const nuptk = normalizeText(payload.nuptk);
  const name = normalizeText(payload.name);
  const className = normalizeText(payload.className);
  const status = normalizeStatus(payload.status);

  if (!nuptk || !name || !className) {
    throw new Error("NUPTK, Nama, dan Kelas wajib diisi.");
  }

  const tenant = resolveTenantContext(profile, payload);
  const now = Date.now();
  const updates: Record<string, any> = {
    [`master_teachers/${nuptk}`]: {
      nuptk,
      name,
      class: className,
      status,
      schoolId: tenant.schoolId,
      schoolName: tenant.schoolName,
      npsn: tenant.npsn,
      createdAt: now,
      updatedAt: now,
    },
    [`teachers/${nuptk}/nuptk`]: nuptk,
    [`teachers/${nuptk}/name`]: name,
    [`teachers/${nuptk}/homeroomClass`]: className,
    [`teachers/${nuptk}/class`]: className,
    [`teachers/${nuptk}/status`]: teacherStatusToLegacy(status),
    [`teachers/${nuptk}/phone`]: "",
    [`teachers/${nuptk}/email`]: "",
    [`teachers/${nuptk}/schoolId`]: tenant.schoolId,
    [`teachers/${nuptk}/schoolName`]: tenant.schoolName,
    [`teachers/${nuptk}/npsn`]: tenant.npsn,
    [`teachers/${nuptk}/createdAt`]: now,
    [`teachers/${nuptk}/updatedAt`]: now,
  };

  await getGasAdminDb().ref().update(updates);

  await writeEduLockAuditEvent(profile, {
    type: "PERSONNEL_TEACHER_CREATE",
    message: `Menambahkan guru baru: ${name} (${nuptk})`,
    schoolId: tenant.schoolId,
    targetId: nuptk,
    metadata: { name, className, status },
  });
}

async function updateTeacher(payload: PersonnelPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const nuptk = normalizeText(payload.nuptk);
  const name = normalizeText(payload.name);
  const className = normalizeText(payload.className);
  const status = normalizeStatus(payload.status);

  if (!nuptk || !name || !className) {
    throw new Error("Data guru tidak lengkap.");
  }

  const existingTeacher = await getExistingTeacher(nuptk);
  if (!existingTeacher) {
    throw new Error("Data guru tidak ditemukan.");
  }

  if (profile.role === "admin" && normalizeText(existingTeacher.schoolId) !== profile.schoolId) {
    throw new Error("Guru berada di luar tenant admin aktif.");
  }

  const tenant = resolveTenantContext(profile, payload, existingTeacher);
  const now = Date.now();
  const updates: Record<string, any> = {
    [`master_teachers/${nuptk}/name`]: name,
    [`master_teachers/${nuptk}/class`]: className,
    [`master_teachers/${nuptk}/status`]: status,
    [`master_teachers/${nuptk}/schoolId`]: tenant.schoolId,
    [`master_teachers/${nuptk}/schoolName`]: tenant.schoolName,
    [`master_teachers/${nuptk}/npsn`]: tenant.npsn,
    [`master_teachers/${nuptk}/updatedAt`]: now,
    [`teachers/${nuptk}/name`]: name,
    [`teachers/${nuptk}/homeroomClass`]: className,
    [`teachers/${nuptk}/class`]: className,
    [`teachers/${nuptk}/status`]: teacherStatusToLegacy(status),
    [`teachers/${nuptk}/schoolId`]: tenant.schoolId,
    [`teachers/${nuptk}/schoolName`]: tenant.schoolName,
    [`teachers/${nuptk}/npsn`]: tenant.npsn,
    [`teachers/${nuptk}/updatedAt`]: now,
  };

  await getGasAdminDb().ref().update(updates);

  await writeEduLockAuditEvent(profile, {
    type: "PERSONNEL_TEACHER_UPDATE",
    message: `Memperbarui data guru: ${name} (${nuptk})`,
    schoolId: tenant.schoolId,
    targetId: nuptk,
    metadata: { name, className, status },
  });
}

async function deleteTeacher(payload: PersonnelPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const nuptk = normalizeText(payload.nuptk);
  if (!nuptk) {
    throw new Error("NUPTK wajib diisi.");
  }

  const existingTeacher = await getExistingTeacher(nuptk);
  if (!existingTeacher) {
    throw new Error("Data guru tidak ditemukan.");
  }

  if (profile.role === "admin" && normalizeText(existingTeacher.schoolId) !== profile.schoolId) {
    throw new Error("Guru berada di luar tenant admin aktif.");
  }

  await getGasAdminDb().ref().update({
    [`master_teachers/${nuptk}`]: null,
    [`teachers/${nuptk}`]: null,
  });

  await writeEduLockAuditEvent(profile, {
    type: "PERSONNEL_TEACHER_DELETE",
    message: `Menghapus data guru: ${existingTeacher.name || nuptk}`,
    schoolId: existingTeacher.schoolId,
    targetId: nuptk,
    metadata: { name: existingTeacher.name, className: existingTeacher.class },
  });
}

async function resetTeacherDevice(payload: PersonnelPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const nuptk = normalizeText(payload.nuptk);
  if (!nuptk) {
    throw new Error("NUPTK wajib diisi.");
  }

  const existingTeacher = await getExistingTeacher(nuptk);
  if (!existingTeacher) {
    throw new Error("Data guru tidak ditemukan.");
  }

  if (profile.role === "admin" && normalizeText(existingTeacher.schoolId) !== profile.schoolId) {
    throw new Error("Guru berada di luar tenant admin aktif.");
  }

  const now = Date.now();
  await getGasAdminDb().ref().update({
    [`master_teachers/${nuptk}/deviceId`]: null,
    [`master_teachers/${nuptk}/device`]: null,
    [`master_teachers/${nuptk}/updatedAt`]: now,
    [`teachers/${nuptk}/deviceId`]: null,
    [`teachers/${nuptk}/device`]: null,
    [`teachers/${nuptk}/updatedAt`]: now,
  });

  await writeEduLockAuditEvent(profile, {
    type: "PERSONNEL_TEACHER_RESET_DEVICE",
    message: `Mereset device guru: ${existingTeacher.name || nuptk}`,
    schoolId: existingTeacher.schoolId,
    targetId: nuptk,
    metadata: { name: existingTeacher.name, className: existingTeacher.class },
  });
}

async function createStaff(payload: PersonnelPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const nisn = normalizeText(payload.nisn);
  const position = normalizeText(payload.position);
  const status = normalizeStatus(payload.status);

  if (!nisn) {
    throw new Error("NISN wajib diisi.");
  }

  const tenant = resolveTenantContext(profile, payload);
  const student = await getExistingStudent(nisn);
  if (!student) {
    throw new Error("NISN belum ada di Database Siswa.");
  }
  if (normalizeText(student.schoolId) !== tenant.schoolId) {
    throw new Error("Siswa ini bukan milik sekolah aktif.");
  }

  const now = Date.now();
  await getGasAdminDb().ref(`master_staff/${nisn}`).set({
    role: "osis",
    nisn,
    position,
    status,
    schoolId: tenant.schoolId,
    schoolName: tenant.schoolName,
    npsn: tenant.npsn,
    createdAt: now,
    updatedAt: now,
  });

  await writeEduLockAuditEvent(profile, {
    type: "PERSONNEL_STAFF_CREATE",
    message: `Menambahkan petugas baru: ${student.name || nisn} (${position})`,
    schoolId: tenant.schoolId,
    targetId: nisn,
    metadata: { position, status },
  });
}

async function updateStaff(payload: PersonnelPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const nisn = normalizeText(payload.nisn);
  const position = normalizeText(payload.position);
  const status = normalizeStatus(payload.status);

  if (!nisn) {
    throw new Error("NISN wajib diisi.");
  }

  const existingStaff = await getExistingStaff(nisn);
  if (!existingStaff) {
    throw new Error("Data petugas tidak ditemukan.");
  }

  if (profile.role === "admin" && normalizeText(existingStaff.schoolId) !== profile.schoolId) {
    throw new Error("Petugas berada di luar tenant admin aktif.");
  }

  await getGasAdminDb().ref(`master_staff/${nisn}`).update({
    role: "osis",
    position,
    status,
    updatedAt: Date.now(),
  });

  await writeEduLockAuditEvent(profile, {
    type: "PERSONNEL_STAFF_UPDATE",
    message: `Memperbarui data petugas: ${nisn} (${position})`,
    schoolId: existingStaff.schoolId,
    targetId: nisn,
    metadata: { position, status },
  });
}

async function deleteStaff(payload: PersonnelPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const nisn = normalizeText(payload.nisn);
  if (!nisn) {
    throw new Error("NISN wajib diisi.");
  }

  const existingStaff = await getExistingStaff(nisn);
  if (!existingStaff) {
    throw new Error("Data petugas tidak ditemukan.");
  }

  if (profile.role === "admin" && normalizeText(existingStaff.schoolId) !== profile.schoolId) {
    throw new Error("Petugas berada di luar tenant admin aktif.");
  }

  await getGasAdminDb().ref(`master_staff/${nisn}`).remove();

  await writeEduLockAuditEvent(profile, {
    type: "PERSONNEL_STAFF_DELETE",
    message: `Menghapus data petugas: ${nisn}`,
    schoolId: existingStaff.schoolId,
    targetId: nisn,
    metadata: { position: existingStaff.position },
  });
}

async function createTatib(payload: PersonnelPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const username = normalizeTatibUsername(payload.username);
  const name = normalizeText(payload.name);
  const password = normalizeText(payload.password);
  const isActive = payload.isActive !== false;

  if (!username || !name || !password) {
    throw new Error("Nama, Username, dan Password wajib diisi.");
  }

  const tenant = resolveTenantContext(profile, payload);
  const now = Date.now();

  await getGasAdminDb().ref(`staff/${username}`).set({
    username,
    name,
    password,
    role: "staff",
    isActive,
    deviceId: null,
    schoolId: tenant.schoolId,
    schoolName: tenant.schoolName,
    npsn: tenant.npsn,
    createdAt: now,
    updatedAt: now,
  });

  await writeEduLockAuditEvent(profile, {
    type: "PERSONNEL_TATIB_CREATE",
    message: `Menambahkan Petugas OSIS baru: ${name} (${username})`,
    schoolId: tenant.schoolId,
    targetId: username,
    metadata: { name, isActive },
  });
}

async function updateTatib(payload: PersonnelPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const username = normalizeTatibUsername(payload.username);
  const name = normalizeText(payload.name);
  const password = normalizeText(payload.password);
  const isActive = payload.isActive !== false;

  if (!username) {
    throw new Error("Username tidak valid.");
  }
  if (!name || !password) {
    throw new Error("Nama dan Password wajib diisi.");
  }

  const existingTatib = await getExistingTatib(username);
  if (!existingTatib) {
    throw new Error("Data Petugas OSIS tidak ditemukan.");
  }

  if (profile.role === "admin" && normalizeText(existingTatib.schoolId) !== profile.schoolId) {
    throw new Error("Petugas OSIS berada di luar tenant admin aktif.");
  }

  const tenant = resolveTenantContext(profile, payload, existingTatib);
  const now = Date.now();

  await getGasAdminDb().ref(`staff/${username}`).update({
    username,
    name,
    password,
    role: "staff",
    isActive,
    schoolId: tenant.schoolId,
    schoolName: tenant.schoolName,
    npsn: tenant.npsn,
    updatedAt: now,
  });

  await writeEduLockAuditEvent(profile, {
    type: "PERSONNEL_TATIB_UPDATE",
    message: `Memperbarui data Petugas OSIS: ${name} (${username})`,
    schoolId: tenant.schoolId,
    targetId: username,
    metadata: { name, isActive },
  });
}

async function resetTatibDevice(payload: PersonnelPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const username = normalizeTatibUsername(payload.username);

  if (!username) {
    throw new Error("Username tidak valid.");
  }

  const existingTatib = await getExistingTatib(username);
  if (!existingTatib) {
    throw new Error("Data Petugas OSIS tidak ditemukan.");
  }

  if (profile.role === "admin" && normalizeText(existingTatib.schoolId) !== profile.schoolId) {
    throw new Error("Petugas OSIS berada di luar tenant admin aktif.");
  }

  await getGasAdminDb().ref(`staff/${username}`).update({
    deviceId: null,
    updatedAt: Date.now(),
  });

  await writeEduLockAuditEvent(profile, {
    type: "PERSONNEL_TATIB_RESET_DEVICE",
    message: `Mereset device Petugas OSIS: ${existingTatib.name || username}`,
    schoolId: existingTatib.schoolId,
    targetId: username,
    metadata: { name: existingTatib.name },
  });
}

async function deleteTatib(payload: PersonnelPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const username = normalizeTatibUsername(payload.username);

  if (!username) {
    throw new Error("Username tidak valid.");
  }

  const existingTatib = await getExistingTatib(username);
  if (!existingTatib) {
    throw new Error("Data Petugas OSIS tidak ditemukan.");
  }

  if (profile.role === "admin" && normalizeText(existingTatib.schoolId) !== profile.schoolId) {
    throw new Error("Petugas OSIS berada di luar tenant admin aktif.");
  }

  await getGasAdminDb().ref(`staff/${username}`).remove();

  await writeEduLockAuditEvent(profile, {
    type: "PERSONNEL_TATIB_DELETE",
    message: `Menghapus data Petugas OSIS: ${existingTatib.name || username}`,
    schoolId: existingTatib.schoolId,
    targetId: username,
    metadata: { name: existingTatib.name },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PersonnelPayload;
    if (body.entity === "teacher") {
      await createTeacher(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Guru berhasil ditambahkan." });
    }
    if (body.entity === "staff") {
      await createStaff(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Petugas berhasil ditambahkan." });
    }
    if (body.entity === "tatib") {
      await createTatib(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Petugas OSIS berhasil ditambahkan." });
    }
    return NextResponse.json({ success: false, message: "Entity personel tidak valid." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as PersonnelPayload;
    if (body.entity === "teacher") {
      await updateTeacher(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Guru berhasil diperbarui." });
    }
    if (body.entity === "staff") {
      await updateStaff(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Petugas berhasil diperbarui." });
    }
    if (body.entity === "tatib") {
      await updateTatib(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Petugas OSIS berhasil diperbarui." });
    }
    return NextResponse.json({ success: false, message: "Entity personel tidak valid." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as PersonnelPayload;
    if (body.entity === "teacher" && body.action === "reset-device") {
      await resetTeacherDevice(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Device guru berhasil direset." });
    }
    if (body.entity === "teacher") {
      await deleteTeacher(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Guru berhasil dihapus." });
    }
    if (body.entity === "staff") {
      await deleteStaff(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Petugas berhasil dihapus." });
    }
    if (body.entity === "tatib" && body.action === "reset-device") {
      await resetTatibDevice(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Device Petugas OSIS berhasil direset." });
    }
    if (body.entity === "tatib") {
      await deleteTatib(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Petugas OSIS berhasil dihapus." });
    }
    return NextResponse.json({ success: false, message: "Entity personel tidak valid." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}
