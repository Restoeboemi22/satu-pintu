import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getGasAdminDb } from "@/lib/server/firebaseAdmin";
import { enforceAdminCapability } from "@/lib/server/adminPolicy";
import { writeEduLockAuditEvent } from "@/lib/server/edulockAudit";

type PrincipalPayload = {
  action?: "toggle-active" | "reset-device" | "bulk-reset-passwords";
  username?: string;
  name?: string;
  schoolId?: string;
  schoolName?: string;
  npsn?: string;
  password?: string;
  isActive?: boolean;
};

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizePrincipalUsername(value: unknown): string {
  return normalizeText(value).toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function generateSecurePassword(length = 10): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}

async function requireSuperAdmin(authorizationHeader?: string | null) {
  const context = await enforceAdminCapability(authorizationHeader, "principals.write", {
    allowGlobalForSuperAdmin: true,
  });
  return context.profile;
}

async function getExistingPrincipal(username: string) {
  const snapshot = await getGasAdminDb().ref(`principal_accounts/${username}`).get();
  if (!snapshot.exists()) return null;
  return snapshot.val() || null;
}

async function getAllPrincipals() {
  const snapshot = await getGasAdminDb().ref("principal_accounts").get();
  if (!snapshot.exists()) return [] as Array<{ username: string; name: string; schoolId: string; schoolName: string; npsn?: string }>;

  return Object.entries<any>(snapshot.val() || {}).map(([key, value]) => ({
    username: normalizePrincipalUsername(value?.username || key),
    name: normalizeText(value?.name),
    schoolId: normalizeText(value?.schoolId),
    schoolName: normalizeText(value?.schoolName),
    npsn: normalizeText(value?.npsn) || undefined,
  }));
}

async function upsertPrincipal(payload: PrincipalPayload, authorizationHeader?: string | null) {
  await requireSuperAdmin(authorizationHeader);

  const now = Date.now();
  const username = normalizePrincipalUsername(payload.username);
  const schoolId = normalizeText(payload.schoolId);
  const schoolName = normalizeText(payload.schoolName);
  const submittedNpsn = normalizeText(payload.npsn);
  const name = normalizeText(payload.name);
  const password = normalizeText(payload.password);

  if (!username) {
    throw new Error("Username kepala sekolah wajib diisi.");
  }
  if (!schoolId) {
    throw new Error("School ID wajib diisi.");
  }

  const existing = await getExistingPrincipal(username);
  const schoolSnapshot = schoolId ? await getGasAdminDb().ref(`schools/${schoolId}`).get() : null;
  const schoolNpsn = normalizeText(schoolSnapshot?.child("npsn").val()) || submittedNpsn;
  if (!existing && !password) {
    throw new Error("Password/NIP wajib diisi untuk akun baru.");
  }

  const updates: Record<string, any> = {
    [`principal_accounts/${username}/username`]: username,
    [`principal_accounts/${username}/name`]: name,
    [`principal_accounts/${username}/schoolId`]: schoolId,
    [`principal_accounts/${username}/schoolName`]: schoolName,
    [`principal_accounts/${username}/npsn`]: schoolNpsn || null,
    [`principal_accounts/${username}/isActive`]: payload.isActive !== false,
    [`principal_accounts/${username}/updatedAt`]: now,
  };

  if (!existing) {
    updates[`principal_accounts/${username}/createdAt`] = now;
  }

  if (password) {
    updates[`principal_accounts/${username}/credentialHash`] = sha256Hex(password);
  }

  await getGasAdminDb().ref().update(updates);

  const profile = await requireSuperAdmin(authorizationHeader);
  await writeEduLockAuditEvent(profile, {
    type: existing ? "PRINCIPAL_UPDATE" : "PRINCIPAL_CREATE",
    message: `${existing ? "Memperbarui" : "Membuat"} akun kepala sekolah: ${name} (${username})`,
    schoolId: schoolId,
    targetId: username,
    metadata: { name, isActive: payload.isActive !== false },
  });

  return { created: !existing, username, schoolId };
}

async function togglePrincipalActive(payload: PrincipalPayload, authorizationHeader?: string | null) {
  await requireSuperAdmin(authorizationHeader);
  const username = normalizePrincipalUsername(payload.username);
  if (!username) {
    throw new Error("Username kepala sekolah tidak valid.");
  }

  const existing = await getExistingPrincipal(username);
  if (!existing) {
    throw new Error("Akun kepala sekolah tidak ditemukan.");
  }

  await getGasAdminDb().ref(`principal_accounts/${username}`).update({
    isActive: payload.isActive !== false,
    updatedAt: Date.now(),
  });

  const profile = await requireSuperAdmin(authorizationHeader);
  await writeEduLockAuditEvent(profile, {
    type: "PRINCIPAL_TOGGLE_ACTIVE",
    message: `Mengubah status aktif kepala sekolah: ${existing.name || username} menjadi ${payload.isActive !== false ? "Aktif" : "Nonaktif"}`,
    schoolId: existing.schoolId,
    targetId: username,
    metadata: { name: existing.name, isActive: payload.isActive !== false },
  });
}

async function resetPrincipalDevice(payload: PrincipalPayload, authorizationHeader?: string | null) {
  await requireSuperAdmin(authorizationHeader);
  const username = normalizePrincipalUsername(payload.username);
  if (!username) {
    throw new Error("Username kepala sekolah tidak valid.");
  }

  const existing = await getExistingPrincipal(username);
  if (!existing) {
    throw new Error("Akun kepala sekolah tidak ditemukan.");
  }

  await getGasAdminDb().ref(`principal_accounts/${username}`).update({
    deviceId: null,
    updatedAt: Date.now(),
  });

  const profile = await requireSuperAdmin(authorizationHeader);
  await writeEduLockAuditEvent(profile, {
    type: "PRINCIPAL_RESET_DEVICE",
    message: `Mereset device kepala sekolah: ${existing.name || username}`,
    schoolId: existing.schoolId,
    targetId: username,
    metadata: { name: existing.name },
  });
}

async function deletePrincipal(payload: PrincipalPayload, authorizationHeader?: string | null) {
  await requireSuperAdmin(authorizationHeader);
  const username = normalizePrincipalUsername(payload.username);
  if (!username) {
    throw new Error("Username kepala sekolah tidak valid.");
  }

  const existing = await getExistingPrincipal(username);
  if (!existing) {
    throw new Error("Akun kepala sekolah tidak ditemukan.");
  }

  await getGasAdminDb().ref(`principal_accounts/${username}`).remove();

  const profile = await requireSuperAdmin(authorizationHeader);
  await writeEduLockAuditEvent(profile, {
    type: "PRINCIPAL_DELETE",
    message: `Menghapus akun kepala sekolah: ${existing.name || username}`,
    schoolId: existing.schoolId,
    targetId: username,
    metadata: { name: existing.name },
  });
}

async function bulkResetPrincipalPasswords(authorizationHeader?: string | null) {
  await requireSuperAdmin(authorizationHeader);
  const principals = await getAllPrincipals();
  if (principals.length === 0) {
    throw new Error("Belum ada akun kepala sekolah untuk diproses.");
  }

  const now = Date.now();
  const updates: Record<string, any> = {};
  const exportedRows: Array<{
    USERNAME: string;
    NAMA: string;
    SEKOLAH: string;
    PASSWORD_BARU: string;
  }> = [];

  for (const principal of principals) {
    if (!principal.username) continue;
    const plainPassword = generateSecurePassword(10);
    updates[`principal_accounts/${principal.username}/credentialHash`] = sha256Hex(plainPassword);
    updates[`principal_accounts/${principal.username}/updatedAt`] = now;
    exportedRows.push({
      USERNAME: principal.username,
      NAMA: principal.name,
      SEKOLAH: principal.schoolName || principal.schoolId,
      PASSWORD_BARU: plainPassword,
    });
  }

  if (exportedRows.length === 0) {
    throw new Error("Tidak ada akun kepala sekolah valid yang bisa diproses.");
  }

  await getGasAdminDb().ref().update(updates);

  const profile = await requireSuperAdmin(authorizationHeader);
  await writeEduLockAuditEvent(profile, {
    type: "PRINCIPAL_BULK_RESET_PASSWORD",
    message: `Mereset password massal untuk ${exportedRows.length} akun kepala sekolah`,
    metadata: { count: exportedRows.length },
  });

  return { exportedRows, updatedAt: now };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PrincipalPayload;
    if (body.action === "bulk-reset-passwords") {
      const result = await bulkResetPrincipalPasswords(request.headers.get("authorization"));
      return NextResponse.json({
        success: true,
        message: "Password massal kepala sekolah berhasil digenerate.",
        data: result,
      });
    }

    const result = await upsertPrincipal(body, request.headers.get("authorization"));
    return NextResponse.json({
      success: true,
      message: result.created ? "Akun kepala sekolah dibuat." : "Akun kepala sekolah diperbarui.",
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as PrincipalPayload;
    if (body.action === "toggle-active") {
      await togglePrincipalActive(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Status kepala sekolah diperbarui." });
    }

    const result = await upsertPrincipal(body, request.headers.get("authorization"));
    return NextResponse.json({
      success: true,
      message: result.created ? "Akun kepala sekolah dibuat." : "Akun kepala sekolah diperbarui.",
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as PrincipalPayload;
    if (body.action === "reset-device") {
      await resetPrincipalDevice(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Device kepala sekolah berhasil di-reset." });
    }

    await deletePrincipal(body, request.headers.get("authorization"));
    return NextResponse.json({ success: true, message: "Akun kepala sekolah dihapus." });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}
