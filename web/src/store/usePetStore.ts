import { create } from 'zustand';
import { database, ensureGasAuth } from '@/lib/firebase';
import { onValue, ref, Unsubscribe } from 'firebase/database';
import { useStudentStore } from './useStudentStore';
import { callAdminApi } from '@/lib/callAdminApi';
import { useAuthStore } from '@/store/useAuthStore';

export interface PetStats {
  level: number;
  exp: number;
  maxExp: number;
  health: number;
  energy: number;
  happiness: number;
  intelligence: number;
  social: number;
  creativity: number;
  coins: number;
  hunger: number;
}

export interface PetData {
  id: string;
  studentId: string;
  schoolId?: string;
  studentName: string; // Added for display
  petName: string;
  type: string;
  status: string;
  manualReviveUntil?: number;
  stats: PetStats;
  lastSync: number;
  lastFed?: number;
  lastPlayed?: number;
  lastQuestReset?: number;
  achievements: string[];
}

interface PetStore {
  pets: PetData[];
  isLoading: boolean;
  
  // Sync function to start listening to Firebase
  initPetSync: (schoolId?: string) => Unsubscribe;
  getPetByStudentId: (studentId: string) => PetData | undefined;
  giveReward: (petIds: string[], type: 'coins' | 'exp' | 'intelligence' | 'social', amount: number) => Promise<void>;
  revivePet: (petId: string) => Promise<void>;
  resetPetLevel: (petId: string) => Promise<void>;
}

function normalizeSchoolScope(value?: string) {
  return String(value || '').trim().toLowerCase();
}

function normalizeIdentity(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function rankPetCandidate(pet: PetData) {
  return Math.max(
    Number(pet.lastSync || 0),
    Number(pet.lastQuestReset || 0),
    Number(pet.lastPlayed || 0),
    Number(pet.lastFed || 0)
  );
}

function isBetterPetCandidate(candidate: PetData, current: PetData) {
  const candidateScore = rankPetCandidate(candidate);
  const currentScore = rankPetCandidate(current);

  if (candidateScore !== currentScore) return candidateScore > currentScore;
  if (candidate.lastSync !== current.lastSync) return candidate.lastSync > current.lastSync;
  if (candidate.stats.level !== current.stats.level) return candidate.stats.level > current.stats.level;
  if (candidate.stats.exp !== current.stats.exp) return candidate.stats.exp > current.stats.exp;
  return candidate.id > current.id;
}

function selectBestPetsByStudent(pets: PetData[]) {
  const bestByStudent = new Map<string, PetData>();

  pets.forEach((pet) => {
    const studentKey = pet.studentId.trim();
    if (!studentKey) return;

    const current = bestByStudent.get(studentKey);
    if (!current || isBetterPetCandidate(pet, current)) {
      bestByStudent.set(studentKey, pet);
    }
  });

  return Array.from(bestByStudent.values());
}

export const usePetStore = create<PetStore>((set, get) => ({
  pets: [],
  isLoading: true,
  
  resetPetLevel: async (petId: string) => {
      try {
          await callAdminApi("/api/admin/virtual-pet", "POST", {
            action: "reset-level",
            petId,
          });
      } catch (error) {
          console.error("Error resetting pet level:", error);
          throw error;
      }
  },

  revivePet: async (petId: string) => {
    try {
        await callAdminApi("/api/admin/virtual-pet", "POST", {
          action: "revive",
          petId,
        });
    } catch (error) {
        console.error("Error reviving pet:", error);
        throw error;
    }
  },

  giveReward: async (petIds, type, amount) => {
      // Don't set global loading as it might flicker UI, just do background update
      try {
          await callAdminApi("/api/admin/virtual-pet", "POST", {
            action: "give-reward",
            petIds,
            rewardType: type,
            amount,
          });
      } catch (error) {
          console.error("Error giving rewards:", error);
          throw error;
      }
  },

  initPetSync: (schoolId?: string) => {
    set({ isLoading: true });
    const authUser = useAuthStore.getState().user;
    const scopedSchoolId = normalizeSchoolScope(schoolId || authUser?.schoolId);
    const isSuperAdmin = authUser?.role === 'super_admin';
    let cancelled = false;
    let unsubscribe: Unsubscribe = () => {};

    void ensureGasAuth()
      .then(() => {
        if (cancelled) return;

        const petsRef = ref(database, 'virtual_pets');
        unsubscribe = onValue(
          petsRef,
          (snapshot) => {
            const data = snapshot.val();
            if (!data) {
              set({ pets: [], isLoading: false });
              return;
            }

            const students = useStudentStore.getState().students;
            const studentLookup = new Map(
              students.flatMap((student) => {
                const keys = [
                  normalizeIdentity(student.id),
                  normalizeIdentity(student.nisn),
                  normalizeIdentity(student.username),
                ].filter(Boolean);
                return keys.map((key) => [key, student] as const);
              })
            );

            const parsedPets: PetData[] = [];
            Object.entries(data).forEach(([petKey, rawPet]: [string, any]) => {
              const rawStudentId = String(rawPet?.studentId || '').trim();
              if (!rawStudentId) return;

              const normalizedStudentId = normalizeIdentity(rawStudentId);
              const student = studentLookup.get(normalizedStudentId);
              const petSchoolId = normalizeSchoolScope(rawPet?.schoolId);
              const studentSchoolId = normalizeSchoolScope(student?.schoolId);

              if (
                !isSuperAdmin &&
                scopedSchoolId &&
                petSchoolId !== scopedSchoolId &&
                studentSchoolId !== scopedSchoolId
              ) {
                return;
              }

              parsedPets.push({
                // Fall back to the RTDB node key because some legacy records do not persist `id` in the value.
                id: String(rawPet.id || petKey || ''),
                studentId: rawStudentId,
                schoolId: rawPet.schoolId ? String(rawPet.schoolId) : student?.schoolId,
                studentName: student?.name || String(rawPet.petName || 'Unknown Student'),
                petName: rawPet.petName || 'Buddy',
                type: rawPet.petType || 'CAT',
                status: rawPet.status || 'HAPPY',
                manualReviveUntil: Number(rawPet.manualReviveUntil || 0) || 0,
                stats: {
                  level: Number(rawPet.level ?? 1) || 1,
                  exp: Number(rawPet.experiencePoints ?? 0) || 0,
                  maxExp: (Number(rawPet.level ?? 1) || 1) * 100,
                  // Preserve zero values from RTDB; zero is meaningful for dead/sekarat state.
                  health: Number(rawPet.health ?? 100),
                  energy: Number(rawPet.energy ?? 100),
                  happiness: Number(rawPet.happiness ?? 100),
                  intelligence: Number(rawPet.intelligence ?? 0) || 0,
                  social: Number(rawPet.social ?? 0) || 0,
                  creativity: 0,
                  coins: Number(rawPet.coins ?? 0) || 0,
                  hunger: Number(rawPet.hunger ?? 0) || 0
                },
                // Do not promote legacy records without `updatedAt` to "latest".
                lastSync: Number(rawPet.updatedAt ?? 0) || 0,
                lastFed: Number(rawPet.lastFed || 0) || 0,
                lastPlayed: Number(rawPet.lastPlayed || 0) || 0,
                lastQuestReset: Number(rawPet.lastQuestReset || 0) || 0,
                achievements: []
              });
            });

            set({ pets: selectBestPetsByStudent(parsedPets), isLoading: false });
          },
          (error) => {
            console.error('Error syncing pets:', error);
            set({ pets: [], isLoading: false });
          }
        );
      })
      .catch((error: any) => {
        console.error('Error starting pet sync:', error);
        set({ pets: [], isLoading: false });
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  },

  getPetByStudentId: (studentId) => {
    return get().pets.find(p => p.studentId === studentId);
  }
}));
