import { create } from 'zustand';
import { database } from '@/lib/firebase';
import { equalTo, onValue, orderByChild, query as rtdbQuery, ref, Unsubscribe } from 'firebase/database';
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
  stats: PetStats;
  lastSync: number;
  achievements: string[];
}

interface PetStore {
  pets: PetData[];
  isLoading: boolean;
  
  // Sync function to start listening to Firebase
  initPetSync: (schoolId?: string) => Unsubscribe;
  getPetByStudentId: (studentId: string) => PetData | undefined;
  giveReward: (petIds: string[], type: 'coins' | 'exp' | 'health' | 'happiness' | 'energy' | 'intelligence' | 'social' | 'hunger', amount: number) => Promise<void>;
  revivePet: (petId: string) => Promise<void>;
  resetPetLevel: (petId: string) => Promise<void>;
}

function normalizeSchoolScope(value?: string) {
  return String(value || '').trim().toLowerCase();
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
    if (!isSuperAdmin && !scopedSchoolId) {
      set({ pets: [], isLoading: false });
      return () => {};
    }

    const petsRef =
      !isSuperAdmin && scopedSchoolId
        ? rtdbQuery(ref(database, 'virtual_pets'), orderByChild('schoolId'), equalTo(scopedSchoolId))
        : ref(database, 'virtual_pets');
    
    return onValue(petsRef, (snapshot) => {
       const data = snapshot.val();
       if (data) {
         const students = useStudentStore.getState().students;
         const parsedPets: PetData[] = [];
         
         Object.values(data).forEach((rawPet: any) => {
            const petSchoolId = normalizeSchoolScope(rawPet?.schoolId);
            if (!isSuperAdmin && petSchoolId !== scopedSchoolId) {
              return;
            }
            // Find student to get name
            const student = students.find(s => s.id.toString() === rawPet.studentId || s.nisn === rawPet.studentId);
            const studentName = student ? student.name : "Unknown Student";

            parsedPets.push({
              id: rawPet.id,
              studentId: rawPet.studentId,
              schoolId: rawPet.schoolId ? String(rawPet.schoolId) : undefined,
              studentName: studentName,
              petName: rawPet.petName || "Buddy",
              type: rawPet.petType || "CAT",
              status: rawPet.status || "HAPPY",
              stats: {
                level: rawPet.level || 1,
                exp: rawPet.experiencePoints || 0,
                maxExp: (rawPet.level || 1) * 100,
                health: rawPet.health || 100,
                energy: rawPet.energy || 100,
                happiness: rawPet.happiness || 100,
                intelligence: rawPet.intelligence || 0,
                social: rawPet.social || 0,
                creativity: 0, // Not tracked in Android yet
                coins: rawPet.coins || 0,
                hunger: rawPet.hunger || 0
              },
              lastSync: rawPet.updatedAt || Date.now(),
              achievements: [] // TODO: Sync achievements if needed
            });
         });
         
         set({ pets: parsedPets, isLoading: false });
       } else {
         set({ pets: [], isLoading: false });
       }
    });
  },

  getPetByStudentId: (studentId) => {
    return get().pets.find(p => p.studentId === studentId);
  }
}));
