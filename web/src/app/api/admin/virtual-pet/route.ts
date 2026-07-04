import { NextRequest, NextResponse } from "next/server";
import { getGasAdminDb } from "@/lib/server/firebaseAdmin";
import { enforceAdminCapability } from "@/lib/server/adminPolicy";
import { writeEduLockAuditEvent } from "@/lib/server/edulockAudit";

type RewardType =
  | "coins"
  | "exp"
  | "health"
  | "happiness"
  | "energy"
  | "intelligence"
  | "social"
  | "hunger";

type VirtualPetPayload = {
  action?: "give-reward" | "revive" | "reset-level";
  schoolId?: string;
  petId?: string;
  petIds?: string[];
  rewardType?: RewardType;
  amount?: number;
};

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSchoolId(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function clampStat(value: number) {
  return Math.min(100, Math.max(0, value));
}

function applyExpReward(rawPet: any, amount: number) {
  let level = Math.max(1, Number(rawPet?.level || 1));
  let experiencePoints = Math.max(0, Number(rawPet?.experiencePoints || 0)) + amount;
  let happiness = clampStat(Number(rawPet?.happiness || 0));
  let energy = clampStat(Number(rawPet?.energy || 0));
  let intelligence = clampStat(Number(rawPet?.intelligence || 0));

  while (experiencePoints >= level * 100) {
    experiencePoints -= level * 100;
    level += 1;
    happiness = 100;
    energy = 100;
    intelligence = clampStat(intelligence + 2);
  }

  return { level, experiencePoints, happiness, energy, intelligence };
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
      updates[`virtual_pets/${petId}/happiness`] = next.happiness;
      updates[`virtual_pets/${petId}/energy`] = next.energy;
      updates[`virtual_pets/${petId}/intelligence`] = next.intelligence;
    } else if (rewardType === "health") {
      updates[`virtual_pets/${petId}/health`] = clampStat(Number(pet?.health || 0) + amount);
    } else if (rewardType === "happiness") {
      updates[`virtual_pets/${petId}/happiness`] = clampStat(Number(pet?.happiness || 0) + amount);
    } else if (rewardType === "energy") {
      updates[`virtual_pets/${petId}/energy`] = clampStat(Number(pet?.energy || 0) + amount);
    } else if (rewardType === "intelligence") {
      updates[`virtual_pets/${petId}/intelligence`] = clampStat(Number(pet?.intelligence || 0) + amount);
    } else if (rewardType === "social") {
      updates[`virtual_pets/${petId}/social`] = clampStat(Number(pet?.social || 0) + amount);
    } else if (rewardType === "hunger") {
      updates[`virtual_pets/${petId}/hunger`] = Math.max(0, Number(pet?.hunger || 0) - amount);
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

  await assertPetScope(petId, context.schoolId);
  await getGasAdminDb().ref().update({
    [`virtual_pets/${petId}/status`]: "HAPPY",
    [`virtual_pets/${petId}/health`]: 50,
    [`virtual_pets/${petId}/happiness`]: 50,
    [`virtual_pets/${petId}/energy`]: 50,
    [`virtual_pets/${petId}/hunger`]: 50,
    [`virtual_pets/${petId}/updatedAt`]: Date.now(),
  });

  await writeEduLockAuditEvent(context.profile, {
    type: "VIRTUAL_PET_REVIVE",
    message: `Menghidupkan kembali pet ${petId}.`,
    schoolId: context.schoolId || undefined,
    targetId: petId,
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
    return NextResponse.json(
      { success: false, message: String(error?.message || error) },
      { status: 400 }
    );
  }
}
