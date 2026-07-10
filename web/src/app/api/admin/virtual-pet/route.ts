import { NextRequest, NextResponse } from "next/server";
import { getGasAdminDb } from "@/lib/server/firebaseAdmin";
import { enforceAdminCapability } from "@/lib/server/adminPolicy";
import { writeEduLockAuditEvent } from "@/lib/server/edulockAudit";
import { promises as fs } from "fs";
import path from "path";

type RewardType =
  | "coins"
  | "exp"
  | "intelligence"
  | "social";

type VirtualPetPayload = {
  action?: "give-reward" | "revive" | "reset-level";
  schoolId?: string;
  petId?: string;
  petIds?: string[];
  rewardType?: RewardType;
  amount?: number;
};

const MANUAL_REVIVE_GRACE_MS = 12 * 60 * 60 * 1000;
const DEBUG_SESSION_ID = "pet-revive-relock";
const DEBUG_ENV_PATH = path.join(process.cwd(), ".dbg", `${DEBUG_SESSION_ID}.env`);

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSchoolId(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function clampStat(value: number) {
  return Math.min(100, Math.max(0, value));
}

async function reportPetReviveDebug(
  hypothesisId: string,
  location: string,
  msg: string,
  data: Record<string, unknown> = {}
) {
  let debugUrl = "http://192.168.100.12:7777/event";
  let sessionId = DEBUG_SESSION_ID;
  try {
    const env = await fs.readFile(DEBUG_ENV_PATH, "utf8");
    debugUrl = env.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugUrl;
    sessionId = env.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || sessionId;
  } catch {}

  void fetch(debugUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      runId: "pre-fix",
      hypothesisId,
      location,
      msg,
      data,
      ts: Date.now(),
    }),
  }).catch(() => {});
}

function applyExpReward(rawPet: any, amount: number) {
  let level = Math.max(1, Number(rawPet?.level || 1));
  let experiencePoints = Math.max(0, Number(rawPet?.experiencePoints || 0)) + amount;
  let intelligence = clampStat(Number(rawPet?.intelligence || 0));

  while (experiencePoints >= level * 100) {
    experiencePoints -= level * 100;
    level += 1;
    intelligence = clampStat(intelligence + 2);
  }

  return { level, experiencePoints, intelligence };
}

async function getPet(petId: string) {
  const snapshot = await getGasAdminDb().ref(`virtual_pets/${petId}`).get();
  if (!snapshot.exists()) {
    throw new Error(`Pet ${petId} tidak ditemukan.`);
  }
  return snapshot.val() || {};
}

async function getStudentSchoolId(studentId: string) {
  const snapshot = await getGasAdminDb().ref(`master_students/${studentId}`).get();
  if (!snapshot.exists()) {
    throw new Error(`Siswa ${studentId} pemilik pet tidak ditemukan.`);
  }
  return normalizeSchoolId(snapshot.val()?.schoolId);
}

async function assertPetScope(petId: string, schoolId: string) {
  const pet = await getPet(petId);
  const studentId = normalizeText(pet.studentId);
  if (!studentId) {
    throw new Error(`Pet ${petId} tidak memiliki studentId yang valid.`);
  }

  const ownerSchoolId = await getStudentSchoolId(studentId);
  if (schoolId && ownerSchoolId !== schoolId) {
    throw new Error(`Pet ${petId} milik sekolah lain.`);
  }

  return pet;
}

async function getScopedPetIdsByStudent(studentId: string, schoolId: string) {
  const normalizedStudentId = normalizeText(studentId);
  const normalizedSchoolId = normalizeSchoolId(schoolId);
  const snapshot = await getGasAdminDb().ref("virtual_pets").get();
  if (!snapshot.exists()) return [];

  const ids: string[] = [];
  snapshot.forEach((child) => {
    const value = child.val() || {};
    const petStudentId = normalizeText(value.studentId);
    if (!petStudentId || petStudentId !== normalizedStudentId) {
      return false;
    }

    const petSchoolId = normalizeSchoolId(value.schoolId);
    if (normalizedSchoolId && petSchoolId && petSchoolId !== normalizedSchoolId) {
      return false;
    }

    if (child.key) {
      ids.push(child.key);
    }
    return false;
  });

  return Array.from(new Set(ids));
}

async function giveReward(payload: VirtualPetPayload, authorizationHeader?: string | null) {
  const context = await enforceAdminCapability(
    authorizationHeader,
    "virtual-pet.write",
    { requestedSchoolId: payload.schoolId, allowGlobalForSuperAdmin: true }
  );

  const petIds = Array.isArray(payload.petIds)
    ? payload.petIds.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  const rewardType = payload.rewardType;
  const amount = Number(payload.amount);

  if (!petIds.length || !rewardType || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payload reward virtual pet tidak valid.");
  }

  const updates: Record<string, any> = {};
  const now = Date.now();

  for (const petId of petIds) {
    const pet = await assertPetScope(petId, context.schoolId);
    if (rewardType === "coins") {
      updates[`virtual_pets/${petId}/coins`] = Number(pet?.coins || 0) + amount;
    } else if (rewardType === "exp") {
      const next = applyExpReward(pet, amount);
      updates[`virtual_pets/${petId}/experiencePoints`] = next.experiencePoints;
      updates[`virtual_pets/${petId}/level`] = next.level;
      updates[`virtual_pets/${petId}/intelligence`] = next.intelligence;
    } else if (rewardType === "intelligence") {
      updates[`virtual_pets/${petId}/intelligence`] = clampStat(Number(pet?.intelligence || 0) + amount);
    } else if (rewardType === "social") {
      updates[`virtual_pets/${petId}/social`] = clampStat(Number(pet?.social || 0) + amount);
    } else {
      throw new Error("Reward untuk 4 bar inti tidak diizinkan. Bar inti hanya boleh berasal dari aktivitas siswa.");
    }
    updates[`virtual_pets/${petId}/updatedAt`] = now;
  }

  await getGasAdminDb().ref().update(updates);
  await writeEduLockAuditEvent(context.profile, {
    type: "VIRTUAL_PET_REWARD",
    message: `Mengirim reward ${rewardType} ke ${petIds.length} pet.`,
    schoolId: context.schoolId || undefined,
    metadata: { petIds, rewardType, amount },
  });
}

async function revivePet(payload: VirtualPetPayload, authorizationHeader?: string | null) {
  const context = await enforceAdminCapability(
    authorizationHeader,
    "virtual-pet.write",
    { requestedSchoolId: payload.schoolId, allowGlobalForSuperAdmin: true }
  );
  const petId = normalizeText(payload.petId);
  if (!petId) throw new Error("petId wajib diisi.");

  // #region debug-point A:web-revive-request
  await reportPetReviveDebug("A", "web/api/admin/virtual-pet/route.ts:revivePet:entry", "[DEBUG] revive request accepted", {
    petId,
    requestedSchoolId: normalizeSchoolId(payload.schoolId),
    scopeSchoolId: context.schoolId || "",
  });
  // #endregion

  const pet = await assertPetScope(petId, context.schoolId);
  const studentId = normalizeText(pet.studentId);
  const ownerSchoolId = await getStudentSchoolId(studentId);
  const effectiveSchoolId = context.schoolId || ownerSchoolId;
  const now = Date.now();
  const manualReviveUntil = now + MANUAL_REVIVE_GRACE_MS;
  const revivedStats = {
    health: 50,
    happiness: 50,
    energy: 50,
    // Hunger disimpan sebagai "tingkat lapar", jadi 50 berarti kembali ke titik netral/aman.
    hunger: 50,
  };
  const siblingPetIds = await getScopedPetIdsByStudent(studentId, effectiveSchoolId);
  const targetPetIds = siblingPetIds.length ? siblingPetIds : [petId];
  const updates: Record<string, number | string> = {};
  targetPetIds.forEach((targetPetId) => {
    updates[`virtual_pets/${targetPetId}/status`] = "HAPPY";
    updates[`virtual_pets/${targetPetId}/health`] = revivedStats.health;
    updates[`virtual_pets/${targetPetId}/happiness`] = revivedStats.happiness;
    updates[`virtual_pets/${targetPetId}/energy`] = revivedStats.energy;
    updates[`virtual_pets/${targetPetId}/hunger`] = revivedStats.hunger;
    updates[`virtual_pets/${targetPetId}/manualReviveUntil`] = manualReviveUntil;
    updates[`virtual_pets/${targetPetId}/updatedAt`] = now;
  });
  await getGasAdminDb().ref().update(updates);

  // #region debug-point A:web-revive-persisted
  const persisted = (await Promise.all(
    targetPetIds.slice(0, 5).map(async (targetPetId) => ({
      petId: targetPetId,
      value: (await getGasAdminDb().ref(`virtual_pets/${targetPetId}`).get()).val() || {},
    }))
  )).map(({ petId: persistedPetId, value }) => ({
    petId: persistedPetId,
    status: String(value.status || ""),
    health: Number(value.health || 0),
    happiness: Number(value.happiness || 0),
    energy: Number(value.energy || 0),
    hunger: Number(value.hunger || 0),
    manualReviveUntil: Number(value.manualReviveUntil || 0),
    updatedAt: Number(value.updatedAt || 0),
  }));
  await reportPetReviveDebug("A", "web/api/admin/virtual-pet/route.ts:revivePet:after-update", "[DEBUG] revive persisted on backend", {
    petId,
    studentId,
    effectiveSchoolId,
    targetPetIdsCount: targetPetIds.length,
    targetPetIdsPreview: targetPetIds.slice(0, 5),
    persisted,
  });
  // #endregion

  await writeEduLockAuditEvent(context.profile, {
    type: "VIRTUAL_PET_REVIVE",
    message: `Menghidupkan kembali pet ${petId} (${targetPetIds.length} record).`,
    schoolId: context.schoolId || undefined,
    targetId: petId,
    metadata: {
      ...revivedStats,
      manualReviveUntil,
      targetPetIds,
    },
  });
}

async function resetLevel(payload: VirtualPetPayload, authorizationHeader?: string | null) {
  const context = await enforceAdminCapability(
    authorizationHeader,
    "virtual-pet.write",
    { requestedSchoolId: payload.schoolId, allowGlobalForSuperAdmin: true }
  );
  const petId = normalizeText(payload.petId);
  if (!petId) throw new Error("petId wajib diisi.");

  await assertPetScope(petId, context.schoolId);
  await getGasAdminDb().ref().update({
    [`virtual_pets/${petId}/level`]: 1,
    [`virtual_pets/${petId}/experiencePoints`]: 0,
    [`virtual_pets/${petId}/updatedAt`]: Date.now(),
  });

  await writeEduLockAuditEvent(context.profile, {
    type: "VIRTUAL_PET_RESET_LEVEL",
    message: `Mereset level pet ${petId}.`,
    schoolId: context.schoolId || undefined,
    targetId: petId,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as VirtualPetPayload;
    if (body.action === "give-reward") {
      await giveReward(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Reward virtual pet berhasil dikirim." });
    }
    if (body.action === "revive") {
      await revivePet(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Pet berhasil dihidupkan kembali." });
    }
    if (body.action === "reset-level") {
      await resetLevel(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Level pet berhasil direset." });
    }

    return NextResponse.json(
      { success: false, message: "Aksi virtual pet tidak valid." },
      { status: 400 }
    );
  } catch (error: any) {
    // #region debug-point A:web-revive-error
    await reportPetReviveDebug("A", "web/api/admin/virtual-pet/route.ts:POST:catch", "[DEBUG] virtual pet admin route failed", {
      error: String(error?.message || error),
    });
    // #endregion
    return NextResponse.json(
      { success: false, message: String(error?.message || error) },
      { status: 400 }
    );
  }
}
