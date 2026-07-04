import { NextRequest, NextResponse } from "next/server";
import { getEduLockAdminDb, getGasAdminDb } from "@/lib/server/firebaseAdmin";
import { requireEduLockAdminProfile } from "@/lib/server/edulockAuth";
import { writeEduLockAuditEvent } from "@/lib/server/edulockAudit";

type StudentMutationPayload = {
  action?:
    | "reset-device"
    | "delete-all"
    | "delete-grade"
    | "delete-class-keyword"
    | "bulk-import"
    | "class-create"
    | "class-update"
    | "class-delete";
  nisn?: string;
  previousNisn?: string;
  previousClassName?: string;
  classKeyword?: string;
  name?: string;
  gender?: "L" | "P" | "";
  religion?: "ISLAM" | "NON_ISLAM" | "";
  className?: string;
  status?: "Aktif" | "Nonaktif" | "";
  schoolId?: string;
  schoolName?: string;
  npsn?: string;
  grade?: 7 | 8 | 9;
  rows?: Array<{
    nisn?: string;
    name?: string;
    gender?: "L" | "P" | "";
    religion?: "ISLAM" | "NON_ISLAM" | "";
    className?: string;
    status?: "Aktif" | "Nonaktif" | "";
  }>;
};

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeStatus(value: unknown): "Aktif" | "Nonaktif" {
  return String(value || "") === "Nonaktif" ? "Nonaktif" : "Aktif";
}

function normalizeGender(value: unknown): "L" | "P" | "" {
  return value === "P" ? "P" : value === "L" ? "L" : "";
}

function normalizeReligion(value: unknown): "ISLAM" | "NON_ISLAM" {
  return String(value || "") === "NON_ISLAM" ? "NON_ISLAM" : "ISLAM";
}

function normalizeOptionalReligion(value: unknown): "ISLAM" | "NON_ISLAM" | "" {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized === "NON_ISLAM" ? "NON_ISLAM" : "ISLAM";
}

function statusToLegacy(status?: "Aktif" | "Nonaktif"): "active" | "inactive" {
  return status === "Nonaktif" ? "inactive" : "active";
}

function toGradeFromClass(className: string): 7 | 8 | 9 | 0 {
  const value = normalizeText(className).toUpperCase();
  if (!value) return 0;
  if (value.startsWith("VIII")) return 8;
  if (value.startsWith("VII")) return 7;
  if (value.startsWith("IX")) return 9;
  if (value.startsWith("8")) return 8;
  if (value.startsWith("7")) return 7;
  if (value.startsWith("9")) return 9;
  return 0;
}

function buildLegacyStudentPatch(params: {
  nisn: string;
  name: string;
  className: string;
  gender?: "L" | "P" | "";
  religion?: "ISLAM" | "NON_ISLAM";
  status?: "Aktif" | "Nonaktif";
  schoolId: string;
  schoolName: string;
  npsn: string;
  syncedAt: number;
}) {
  const base = `students/${params.nisn}`;
  return {
    [`${base}/nisn`]: params.nisn,
    [`${base}/name`]: params.name,
    [`${base}/class`]: params.className,
    [`${base}/gender`]: params.gender || "",
    [`${base}/religion`]: params.religion || "ISLAM",
    [`${base}/status`]: statusToLegacy(params.status),
    [`${base}/schoolId`]: params.schoolId,
    [`${base}/schoolName`]: params.schoolName,
    [`${base}/npsn`]: params.npsn,
    [`${base}/syncedFrom`]: "portalkita_api",
    [`${base}/syncedAt`]: params.syncedAt,
  } as Record<string, any>;
}

function buildEduLockStudentPatch(params: {
  nisn: string;
  name: string;
  className: string;
  gender?: "L" | "P" | "";
  religion?: "ISLAM" | "NON_ISLAM";
  status?: "Aktif" | "Nonaktif";
  schoolId: string;
  schoolName: string;
  npsn: string;
  syncedAt: number;
}) {
  const base = `students/${params.nisn}`;
  const updates: Record<string, any> = {
    [`${base}/nisn`]: params.nisn,
    [`${base}/name`]: params.name,
    [`${base}/class`]: params.className,
    [`${base}/gender`]: params.gender || "",
    [`${base}/religion`]: params.religion || "ISLAM",
    [`${base}/status`]: statusToLegacy(params.status),
    [`${base}/schoolId`]: params.schoolId,
    [`${base}/schoolName`]: params.schoolName,
    [`${base}/npsn`]: params.npsn,
    [`${base}/syncedFrom`]: "dashboard_satu_pintu_api",
    [`${base}/syncedAt`]: params.syncedAt,
  };

  if (params.schoolId) {
    updates[`students_by_school/${params.schoolId}/${params.nisn}`] = true;
  }

  return updates;
}

function buildEduLockStudentDeletePatch(params: { nisn: string; schoolId: string }) {
  const updates: Record<string, any> = {
    [`students/${params.nisn}`]: null,
    [`active_sessions/${params.nisn}`]: null,
  };

  if (params.schoolId) {
    updates[`students_by_school/${params.schoolId}/${params.nisn}`] = null;
    updates[`active_sessions_by_school/${params.schoolId}/${params.nisn}`] = null;
  }

  return updates;
}

function normalizeEduLockClassKey(value: unknown): string {
  return normalizeText(value).toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "");
}

async function getExistingStudent(nisn: string) {
  const gasDb = getGasAdminDb();
  const snapshot = await gasDb.ref(`master_students/${nisn}`).get();
  if (!snapshot.exists()) return null;
  return snapshot.val() || null;
}

async function getStudentsBySchoolId(schoolId: string) {
  const gasDb = getGasAdminDb();
  const normalizedSchoolId = normalizeText(schoolId).toLowerCase();
  const snapshot = await gasDb.ref("master_students").get();
  if (!snapshot.exists()) return [];

  return Object.entries<any>(snapshot.val() || {})
    .map(([key, value]) => ({
      nisn: normalizeText(value?.nisn || key),
      name: normalizeText(value?.name),
      gender: normalizeGender(value?.gender),
      religion: normalizeReligion(value?.religion),
      status: normalizeStatus(value?.status),
      schoolId: normalizeText(value?.schoolId),
      className: normalizeText(value?.class),
    }))
    .filter((student) => normalizeText(student.schoolId).toLowerCase() === normalizedSchoolId);
}

async function getClassesBySchoolId(schoolId: string) {
  const snapshot = await getGasAdminDb().ref(`master_classes/${schoolId}`).get();
  if (!snapshot.exists()) return {};
  return (snapshot.val() || {}) as Record<string, any>;
}

function resolveTenantContext(
  profile: Awaited<ReturnType<typeof requireEduLockAdminProfile>>,
  payload: StudentMutationPayload,
  existingStudent?: any
) {
  const requestedSchoolId = normalizeText(payload.schoolId || existingStudent?.schoolId);
  const requestedSchoolName = normalizeText(payload.schoolName || existingStudent?.schoolName);
  const requestedNpsn = normalizeText(payload.npsn || existingStudent?.npsn);

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

async function createStudent(payload: StudentMutationPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const nisn = normalizeText(payload.nisn);
  const name = normalizeText(payload.name);
  const className = normalizeText(payload.className);
  const gender = normalizeGender(payload.gender);
  const religion = normalizeReligion(payload.religion);
  const status = normalizeStatus(payload.status);

  if (!nisn || !name || !className) {
    throw new Error("NISN, Nama, dan Kelas wajib diisi.");
  }

  const tenant = resolveTenantContext(profile, payload);
  const now = Date.now();

  const gasUpdates: Record<string, any> = {
    [`master_students/${nisn}`]: {
      nisn,
      name,
      gender,
      religion,
      class: className,
      status,
      device: "",
      schoolId: tenant.schoolId,
      schoolName: tenant.schoolName,
      npsn: tenant.npsn,
      createdAt: now,
      updatedAt: now,
    },
    ...buildLegacyStudentPatch({
      nisn,
      name,
      className,
      gender,
      religion,
      status,
      schoolId: tenant.schoolId,
      schoolName: tenant.schoolName,
      npsn: tenant.npsn,
      syncedAt: now,
    }),
  };

  const edulockUpdates = buildEduLockStudentPatch({
    nisn,
    name,
    className,
    gender,
    religion,
    status,
    schoolId: tenant.schoolId,
    schoolName: tenant.schoolName,
    npsn: tenant.npsn,
    syncedAt: now,
  });

  await Promise.all([
    getGasAdminDb().ref().update(gasUpdates),
    getEduLockAdminDb().ref().update(edulockUpdates),
  ]);

  await writeEduLockAuditEvent(profile, {
    type: "STUDENT_CREATE",
    message: `Menambahkan siswa baru: ${name} (${nisn})`,
    schoolId: tenant.schoolId,
    targetId: nisn,
    metadata: { name, className, gender, religion, status },
  });
}

async function updateStudent(payload: StudentMutationPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const currentNisn = normalizeText(payload.previousNisn || payload.nisn);
  const nextNisn = normalizeText(payload.nisn || payload.previousNisn);
  const name = normalizeText(payload.name);
  const className = normalizeText(payload.className);
  const requestedGender = normalizeGender(payload.gender);
  const requestedReligion = normalizeOptionalReligion(payload.religion);
  const status = normalizeStatus(payload.status);

  if (!currentNisn || !nextNisn || !name || !className) {
    throw new Error("Data siswa tidak lengkap untuk diperbarui.");
  }

  const existingStudent = await getExistingStudent(currentNisn);
  if (!existingStudent) {
    throw new Error("Data siswa tidak ditemukan.");
  }

  if (profile.role === "admin" && normalizeText(existingStudent.schoolId) !== profile.schoolId) {
    throw new Error("Siswa berada di luar tenant admin aktif.");
  }

  const tenant = resolveTenantContext(profile, payload, existingStudent);
  const now = Date.now();
  const gender = requestedGender || normalizeGender(existingStudent.gender);
  const religion = requestedReligion || normalizeReligion(existingStudent.religion);

  const gasUpdates: Record<string, any> = {
    [`master_students/${nextNisn}`]: {
      ...existingStudent,
      nisn: nextNisn,
      name,
      gender,
      religion,
      class: className,
      status,
      schoolId: tenant.schoolId,
      schoolName: tenant.schoolName,
      npsn: tenant.npsn,
      updatedAt: now,
    },
    ...buildLegacyStudentPatch({
      nisn: nextNisn,
      name,
      className,
      gender,
      religion,
      status,
      schoolId: tenant.schoolId,
      schoolName: tenant.schoolName,
      npsn: tenant.npsn,
      syncedAt: now,
    }),
  };

  if (currentNisn !== nextNisn) {
    gasUpdates[`master_students/${currentNisn}`] = null;
    gasUpdates[`students/${currentNisn}`] = null;
  }

  const edulockUpdates = buildEduLockStudentPatch({
    nisn: nextNisn,
    name,
    className,
    gender,
    religion,
    status,
    schoolId: tenant.schoolId,
    schoolName: tenant.schoolName,
    npsn: tenant.npsn,
    syncedAt: now,
  });

  if (currentNisn !== nextNisn) {
    Object.assign(
      edulockUpdates,
      buildEduLockStudentDeletePatch({ nisn: currentNisn, schoolId: tenant.schoolId })
    );
  }

  await Promise.all([
    getGasAdminDb().ref().update(gasUpdates),
    getEduLockAdminDb().ref().update(edulockUpdates),
  ]);

  await writeEduLockAuditEvent(profile, {
    type: "STUDENT_UPDATE",
    message: `Memperbarui data siswa: ${name} (${nextNisn})`,
    schoolId: tenant.schoolId,
    targetId: nextNisn,
    metadata: { previousNisn: currentNisn !== nextNisn ? currentNisn : undefined, name, className, gender, religion, status },
  });
}

async function deleteStudent(payload: StudentMutationPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const nisn = normalizeText(payload.nisn);
  if (!nisn) {
    throw new Error("NISN wajib diisi.");
  }

  const existingStudent = await getExistingStudent(nisn);
  if (!existingStudent) {
    throw new Error("Data siswa tidak ditemukan.");
  }

  if (profile.role === "admin" && normalizeText(existingStudent.schoolId) !== profile.schoolId) {
    throw new Error("Siswa berada di luar tenant admin aktif.");
  }

  const tenant = resolveTenantContext(profile, payload, existingStudent);

  await Promise.all([
    getGasAdminDb().ref().update({
      [`master_students/${nisn}`]: null,
      [`students/${nisn}`]: null,
    }),
    getEduLockAdminDb().ref().update(buildEduLockStudentDeletePatch({ nisn, schoolId: tenant.schoolId })),
  ]);

  await writeEduLockAuditEvent(profile, {
    type: "STUDENT_DELETE",
    message: `Menghapus data siswa: ${existingStudent.name || nisn}`,
    schoolId: tenant.schoolId,
    targetId: nisn,
    metadata: { name: existingStudent.name, className: existingStudent.class },
  });
}

async function resetStudentDevice(payload: StudentMutationPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const nisn = normalizeText(payload.nisn);
  if (!nisn) {
    throw new Error("NISN wajib diisi.");
  }

  const existingStudent = await getExistingStudent(nisn);
  if (!existingStudent) {
    throw new Error("Data siswa tidak ditemukan.");
  }

  if (profile.role === "admin" && normalizeText(existingStudent.schoolId) !== profile.schoolId) {
    throw new Error("Siswa berada di luar tenant admin aktif.");
  }

  const tenant = resolveTenantContext(profile, payload, existingStudent);
  const now = Date.now();
  const deviceId = normalizeText(existingStudent.deviceId || existingStudent.device);

  const gasUpdates: Record<string, any> = {
    [`master_students/${nisn}/deviceId`]: null,
    [`master_students/${nisn}/device`]: "",
    [`master_students/${nisn}/lastLogin`]: null,
    [`master_students/${nisn}/lastLoginAt`]: null,
    [`master_students/${nisn}/updatedAt`]: now,
    [`students/${nisn}/deviceId`]: null,
    [`students/${nisn}/device`]: "",
    [`students/${nisn}/lastLogin`]: null,
    [`students/${nisn}/lastLoginAt`]: null,
  };

  if (deviceId) {
    gasUpdates[`device_locks/${deviceId}`] = null;
  }

  await Promise.all([
    getGasAdminDb().ref().update(gasUpdates),
    getEduLockAdminDb().ref().update({
      [`students/${nisn}/device_uuid`]: null,
    }),
  ]);

  await writeEduLockAuditEvent(profile, {
    type: "STUDENT_RESET_DEVICE",
    message: `Mereset device siswa: ${existingStudent.name || nisn}`,
    schoolId: tenant.schoolId,
    targetId: nisn,
    metadata: { name: existingStudent.name, className: existingStudent.class, oldDeviceId: deviceId },
  });
}

async function deleteStudentsByClassKeyword(payload: StudentMutationPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const tenant = resolveTenantContext(profile, payload);
  const keyword = normalizeText(payload.classKeyword).toUpperCase();

  if (!tenant.schoolId) {
    throw new Error("schoolId tenant tidak valid.");
  }
  if (!keyword) {
    throw new Error("Kata kunci kelas wajib diisi.");
  }

  const students = (await getStudentsBySchoolId(tenant.schoolId)).filter((student) =>
    normalizeText(student.className).toUpperCase().includes(keyword)
  );

  if (students.length === 0) {
    return { count: 0 };
  }

  const gasUpdates: Record<string, any> = {};
  const edulockUpdates: Record<string, any> = {};

  for (const student of students) {
    gasUpdates[`master_students/${student.nisn}`] = null;
    gasUpdates[`students/${student.nisn}`] = null;
    Object.assign(
      edulockUpdates,
      buildEduLockStudentDeletePatch({ nisn: student.nisn, schoolId: tenant.schoolId })
    );
  }

  await Promise.all([
    getGasAdminDb().ref().update(gasUpdates),
    getEduLockAdminDb().ref().update(edulockUpdates),
  ]);

  await writeEduLockAuditEvent(profile, {
    type: "STUDENT_DELETE_CLASS_KEYWORD",
    message: `Menghapus data siswa berdasarkan kata kunci kelas "${keyword}" (${students.length} siswa)`,
    schoolId: tenant.schoolId,
    metadata: { classKeyword: keyword, count: students.length },
  });

  return { count: students.length };
}

async function createClass(payload: StudentMutationPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const tenant = resolveTenantContext(profile, payload);
  const className = normalizeText(payload.className);
  const requestedGrade = Number(payload.grade || 0) as 7 | 8 | 9 | 0;
  const derivedGrade = toGradeFromClass(className);

  if (!tenant.schoolId) {
    throw new Error("schoolId tenant tidak valid.");
  }
  if (!className) {
    throw new Error("Nama kelas wajib diisi.");
  }
  if (derivedGrade !== 7 && derivedGrade !== 8 && derivedGrade !== 9) {
    throw new Error("Format kelas tidak valid.");
  }
  if (requestedGrade && requestedGrade !== derivedGrade) {
    throw new Error("Nama kelas harus sesuai dengan jenjang yang dipilih.");
  }

  const classes = await getClassesBySchoolId(tenant.schoolId);
  const classKey = normalizeEduLockClassKey(className);
  const upperClassName = className.toUpperCase();
  const hasActiveManualClass = Object.entries<any>(classes).some(([key, value]) => {
    const currentName = normalizeText(value?.class || value?.className || key).toUpperCase();
    return currentName === upperClassName && value?.disabled !== true;
  });
  const hasStudentClass = (await getStudentsBySchoolId(tenant.schoolId)).some(
    (student) => normalizeText(student.className).toUpperCase() === upperClassName
  );

  if (hasActiveManualClass || hasStudentClass) {
    throw new Error("Kelas ini sudah ada.");
  }

  const now = Date.now();
  await Promise.all([
    getGasAdminDb().ref(`master_classes/${tenant.schoolId}/${className}`).set({
      class: className,
      className,
      grade: derivedGrade,
      disabled: false,
      schoolId: tenant.schoolId,
      schoolName: tenant.schoolName,
      npsn: tenant.npsn,
      createdAt: now,
      updatedAt: now,
    }),
    classKey
      ? getEduLockAdminDb().ref(`schools/${tenant.schoolId}/classes/${classKey}`).set({
          key: classKey,
          name: className,
          createdAt: now,
          updatedAt: now,
        })
      : Promise.resolve(),
  ]);

  await writeEduLockAuditEvent(profile, {
    type: "CLASS_CREATE",
    message: `Menambahkan kelas baru: ${className}`,
    schoolId: tenant.schoolId,
    targetId: className,
    metadata: { grade: derivedGrade },
  });
}

async function deleteClass(payload: StudentMutationPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const tenant = resolveTenantContext(profile, payload);
  const className = normalizeText(payload.className);
  const upperClassName = className.toUpperCase();

  if (!tenant.schoolId) {
    throw new Error("schoolId tenant tidak valid.");
  }
  if (!className) {
    throw new Error("Nama kelas tidak valid.");
  }

  const students = await getStudentsBySchoolId(tenant.schoolId);
  const affectedStudents = students.filter((student) => normalizeText(student.className).toUpperCase() === upperClassName);
  if (affectedStudents.length > 0) {
    throw new Error(`Tidak bisa hapus kelas ini karena masih ada ${affectedStudents.length} siswa. Pindahkan siswa dulu.`);
  }

  const existingClasses = await getClassesBySchoolId(tenant.schoolId);
  const existingClassEntry =
    existingClasses[className] ||
    Object.entries<any>(existingClasses).find(([key, value]) => normalizeText(value?.class || value?.className || key).toUpperCase() === upperClassName)?.[1];
  const classKey = normalizeEduLockClassKey(className);
  const derivedGrade = toGradeFromClass(className);
  const now = Date.now();

  if (existingClassEntry) {
    await Promise.all([
      getGasAdminDb().ref(`master_classes/${tenant.schoolId}/${className}`).remove(),
      classKey ? getEduLockAdminDb().ref(`schools/${tenant.schoolId}/classes/${classKey}`).remove() : Promise.resolve(),
    ]);
  } else {
    await Promise.all([
      getGasAdminDb().ref(`master_classes/${tenant.schoolId}/${className}`).set({
        class: className,
        className,
        grade: derivedGrade === 7 || derivedGrade === 8 || derivedGrade === 9 ? derivedGrade : 7,
        disabled: true,
        schoolId: tenant.schoolId,
        schoolName: tenant.schoolName,
        npsn: tenant.npsn,
        createdAt: now,
        updatedAt: now,
      }),
      classKey ? getEduLockAdminDb().ref(`schools/${tenant.schoolId}/classes/${classKey}`).remove() : Promise.resolve(),
    ]);
  }

  await writeEduLockAuditEvent(profile, {
    type: "CLASS_DELETE",
    message: `Menghapus kelas: ${className}`,
    schoolId: tenant.schoolId,
    targetId: className,
    metadata: { existedInManualRegistry: Boolean(existingClassEntry) },
  });
}

async function updateClass(payload: StudentMutationPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const tenant = resolveTenantContext(profile, payload);
  const oldClassName = normalizeText(payload.previousClassName);
  const newClassName = normalizeText(payload.className);
  const requestedGrade = Number(payload.grade || 0) as 7 | 8 | 9 | 0;
  const oldKey = oldClassName.toUpperCase();
  const newKey = newClassName.toUpperCase();
  const derivedGrade = toGradeFromClass(newClassName);

  if (!tenant.schoolId) {
    throw new Error("schoolId tenant tidak valid.");
  }
  if (!oldClassName || !newClassName) {
    throw new Error("Nama kelas lama dan baru wajib diisi.");
  }
  if (derivedGrade !== 7 && derivedGrade !== 8 && derivedGrade !== 9) {
    throw new Error("Format kelas baru tidak valid.");
  }
  if (requestedGrade && requestedGrade !== derivedGrade) {
    throw new Error("Nama kelas harus sesuai dengan jenjang yang dipilih.");
  }
  if (oldKey === newKey) {
    return { changed: false };
  }

  const [students, classes] = await Promise.all([
    getStudentsBySchoolId(tenant.schoolId),
    getClassesBySchoolId(tenant.schoolId),
  ]);

  const hasManualNewClass = Object.entries<any>(classes).some(([key, value]) => {
    const currentName = normalizeText(value?.class || value?.className || key).toUpperCase();
    return currentName === newKey && value?.disabled !== true;
  });
  const hasStudentNewClass = students.some((student) => normalizeText(student.className).toUpperCase() === newKey);
  if (hasManualNewClass || hasStudentNewClass) {
    throw new Error("Nama kelas sudah digunakan.");
  }

  const existingOldClass =
    classes[oldClassName] ||
    Object.entries<any>(classes).find(([key, value]) => normalizeText(value?.class || value?.className || key).toUpperCase() === oldKey)?.[1];
  const affectedStudents = students.filter((student) => normalizeText(student.className).toUpperCase() === oldKey);
  const now = Date.now();
  const gasUpdates: Record<string, any> = {
    [`master_classes/${tenant.schoolId}/${newClassName}`]: {
      class: newClassName,
      className: newClassName,
      grade: derivedGrade,
      disabled: false,
      schoolId: tenant.schoolId,
      schoolName: tenant.schoolName,
      npsn: tenant.npsn,
      createdAt: now,
      updatedAt: now,
    },
  };

  if (existingOldClass) {
    gasUpdates[`master_classes/${tenant.schoolId}/${oldClassName}`] = null;
  } else {
    gasUpdates[`master_classes/${tenant.schoolId}/${oldClassName}`] = {
      class: oldClassName,
      className: oldClassName,
      grade: toGradeFromClass(oldClassName) || derivedGrade,
      disabled: true,
      schoolId: tenant.schoolId,
      schoolName: tenant.schoolName,
      npsn: tenant.npsn,
      createdAt: now,
      updatedAt: now,
    };
  }

  const edulockUpdates: Record<string, any> = {};
  for (const student of affectedStudents) {
    gasUpdates[`master_students/${student.nisn}/class`] = newClassName;
    gasUpdates[`master_students/${student.nisn}/updatedAt`] = now;
    gasUpdates[`students/${student.nisn}/class`] = newClassName;
    gasUpdates[`students/${student.nisn}/syncedFrom`] = "portalkita_api";
    gasUpdates[`students/${student.nisn}/syncedAt`] = now;

    Object.assign(
      edulockUpdates,
      buildEduLockStudentPatch({
        nisn: student.nisn,
        name: normalizeText(student.name),
        className: newClassName,
        gender: student.gender,
        religion: student.religion,
        status: student.status,
        schoolId: tenant.schoolId,
        schoolName: tenant.schoolName,
        npsn: tenant.npsn,
        syncedAt: now,
      })
    );
  }

  const oldClassKey = normalizeEduLockClassKey(oldClassName);
  const newClassKey = normalizeEduLockClassKey(newClassName);
  if (oldClassKey) edulockUpdates[`schools/${tenant.schoolId}/classes/${oldClassKey}`] = null;
  if (newClassKey) {
    edulockUpdates[`schools/${tenant.schoolId}/classes/${newClassKey}`] = {
      key: newClassKey,
      name: newClassName,
      createdAt: now,
      updatedAt: now,
    };
  }

  await Promise.all([
    getGasAdminDb().ref().update(gasUpdates),
    getEduLockAdminDb().ref().update(edulockUpdates),
  ]);

  await writeEduLockAuditEvent(profile, {
    type: "CLASS_UPDATE",
    message: `Mengganti nama kelas ${oldClassName} menjadi ${newClassName}.`,
    schoolId: tenant.schoolId,
    targetId: newClassName,
    metadata: { previousClassName: oldClassName, affectedStudents: affectedStudents.length, grade: derivedGrade },
  });

  return { changed: true, affectedStudents: affectedStudents.length };
}

async function deleteAllStudentsBySchool(payload: StudentMutationPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const tenant = resolveTenantContext(profile, payload);
  if (!tenant.schoolId) {
    throw new Error("schoolId tenant tidak valid.");
  }

  const students = await getStudentsBySchoolId(tenant.schoolId);
  if (students.length === 0) {
    return { count: 0 };
  }

  const gasUpdates: Record<string, any> = {};
  const edulockUpdates: Record<string, any> = {};

  for (const student of students) {
    if (!student.nisn) continue;
    gasUpdates[`master_students/${student.nisn}`] = null;
    gasUpdates[`students/${student.nisn}`] = null;
    Object.assign(
      edulockUpdates,
      buildEduLockStudentDeletePatch({ nisn: student.nisn, schoolId: tenant.schoolId })
    );
  }

  await Promise.all([
    getGasAdminDb().ref().update(gasUpdates),
    getEduLockAdminDb().ref().update(edulockUpdates),
  ]);

  await writeEduLockAuditEvent(profile, {
    type: "STUDENT_DELETE_ALL",
    message: `Menghapus semua data siswa (${students.length} siswa)`,
    schoolId: tenant.schoolId,
    metadata: { count: students.length },
  });

  return { count: students.length };
}

async function deleteStudentsByGrade(payload: StudentMutationPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const tenant = resolveTenantContext(profile, payload);
  const grade = Number(payload.grade || 0) as 7 | 8 | 9 | 0;

  if (!tenant.schoolId) {
    throw new Error("schoolId tenant tidak valid.");
  }
  if (grade !== 7 && grade !== 8 && grade !== 9) {
    throw new Error("Jenjang siswa tidak valid.");
  }

  const students = (await getStudentsBySchoolId(tenant.schoolId)).filter(
    (student) => toGradeFromClass(student.className) === grade
  );

  if (students.length === 0) {
    return { count: 0 };
  }

  const gasUpdates: Record<string, any> = {};
  const edulockUpdates: Record<string, any> = {};

  for (const student of students) {
    gasUpdates[`master_students/${student.nisn}`] = null;
    gasUpdates[`students/${student.nisn}`] = null;
    Object.assign(
      edulockUpdates,
      buildEduLockStudentDeletePatch({ nisn: student.nisn, schoolId: tenant.schoolId })
    );
  }

  await Promise.all([
    getGasAdminDb().ref().update(gasUpdates),
    getEduLockAdminDb().ref().update(edulockUpdates),
  ]);

  await writeEduLockAuditEvent(profile, {
    type: "STUDENT_DELETE_GRADE",
    message: `Menghapus data siswa kelas ${grade} (${students.length} siswa)`,
    schoolId: tenant.schoolId,
    metadata: { grade, count: students.length },
  });

  return { count: students.length };
}

async function bulkImportStudents(payload: StudentMutationPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const tenant = resolveTenantContext(profile, payload);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  if (!tenant.schoolId) {
    throw new Error("schoolId tenant tidak valid.");
  }
  if (rows.length === 0) {
    return { count: 0, skipped: 0 };
  }

  const gasUpdates: Record<string, any> = {};
  const edulockUpdates: Record<string, any> = {};
  const now = Date.now();
  let count = 0;
  let skipped = 0;

  for (const row of rows) {
    const nisn = normalizeText(row.nisn);
    const name = normalizeText(row.name);
    const className = normalizeText(row.className);
    const gender = normalizeGender(row.gender);
    const religion = normalizeReligion(row.religion);
    const status = normalizeStatus(row.status);

    if (!nisn || !name || !className) {
      skipped += 1;
      continue;
    }

    gasUpdates[`master_students/${nisn}`] = {
      nisn,
      name,
      gender,
      religion,
      class: className,
      status,
      device: "",
      schoolId: tenant.schoolId,
      schoolName: tenant.schoolName,
      npsn: tenant.npsn,
      createdAt: now,
      updatedAt: now,
    };

    Object.assign(
      gasUpdates,
      buildLegacyStudentPatch({
        nisn,
        name,
        className,
        gender,
        religion,
        status,
        schoolId: tenant.schoolId,
        schoolName: tenant.schoolName,
        npsn: tenant.npsn,
        syncedAt: now,
      })
    );

    Object.assign(
      edulockUpdates,
      buildEduLockStudentPatch({
        nisn,
        name,
        className,
        gender,
        religion,
        status,
        schoolId: tenant.schoolId,
        schoolName: tenant.schoolName,
        npsn: tenant.npsn,
        syncedAt: now,
      })
    );

    count += 1;
  }

  if (count > 0) {
    await Promise.all([
      getGasAdminDb().ref().update(gasUpdates),
      getEduLockAdminDb().ref().update(edulockUpdates),
    ]);

    await writeEduLockAuditEvent(profile, {
      type: "STUDENT_BULK_IMPORT",
      message: `Import massal siswa (${count} berhasil, ${skipped} dilewati)`,
      schoolId: tenant.schoolId,
      metadata: { count, skipped },
    });
  }

  return { count, skipped };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as StudentMutationPayload;
    if (body.action === "class-create") {
      await createClass(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Kelas berhasil ditambahkan." });
    }
    if (body.action === "bulk-import") {
      const result = await bulkImportStudents(body, request.headers.get("authorization"));
      return NextResponse.json({
        success: true,
        message: "Import siswa selesai diproses.",
        data: result,
      });
    }

    await createStudent(body, request.headers.get("authorization"));
    return NextResponse.json({ success: true, message: "Siswa berhasil ditambahkan." });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as StudentMutationPayload;
    if (body.action === "class-update") {
      const result = await updateClass(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Kelas berhasil diperbarui.", data: result });
    }
    await updateStudent(body, request.headers.get("authorization"));
    return NextResponse.json({ success: true, message: "Siswa berhasil diperbarui." });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as StudentMutationPayload & { action?: string };
    if (body.action === "reset-device") {
      await resetStudentDevice(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Device binding siswa berhasil direset." });
    }
    if (body.action === "delete-all") {
      const result = await deleteAllStudentsBySchool(body, request.headers.get("authorization"));
      return NextResponse.json({
        success: true,
        message: "Semua data siswa berhasil dihapus.",
        data: result,
      });
    }
    if (body.action === "delete-grade") {
      const result = await deleteStudentsByGrade(body, request.headers.get("authorization"));
      return NextResponse.json({
        success: true,
        message: "Data siswa per jenjang berhasil dihapus.",
        data: result,
      });
    }
    if (body.action === "delete-class-keyword") {
      const result = await deleteStudentsByClassKeyword(body, request.headers.get("authorization"));
      return NextResponse.json({
        success: true,
        message: "Data siswa berdasarkan filter kelas berhasil dihapus.",
        data: result,
      });
    }
    if (body.action === "class-delete") {
      await deleteClass(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Kelas berhasil dihapus." });
    }

    await deleteStudent(body, request.headers.get("authorization"));
    return NextResponse.json({ success: true, message: "Siswa berhasil dihapus." });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}
