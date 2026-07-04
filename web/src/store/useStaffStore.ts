import { create } from 'zustand';
import { Staff } from '@/types/staff';
import { database } from '@/lib/firebase';
import { ref, onValue, push, set as firebaseSet, remove, update, Unsubscribe } from 'firebase/database';

interface StaffState {
  staffList: Staff[];
  loading: boolean;
  error: string | null;
  unsubscribe: Unsubscribe | null;

  addStaff: (staff: Omit<Staff, "id">) => Promise<void>;
  updateStaff: (id: string, updates: Partial<Staff>) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  resetDevice: (id: string) => Promise<void>;
  syncStaff: () => () => void;
}

export const useStaffStore = create<StaffState>()((set, get) => ({
  staffList: [],
  loading: false,
  error: null,
  unsubscribe: null,

  resetDevice: async (id) => {
    set({ loading: true });
    try {
        const staffRef = ref(database, `staff/${id}`);
        await update(staffRef, { deviceId: null });
        set({ loading: false });
    } catch (error: any) {
        set({ error: error.message, loading: false });
        throw error;
    }
  },

  syncStaff: () => {
    const state = get();
    if (state.unsubscribe) {
      state.unsubscribe();
    }

    set({ loading: true });
    const staffRef = ref(database, 'staff');
    
    const unsubscribe = onValue(staffRef, (snapshot) => {
      const data = snapshot.val();
      const loadedStaff: Staff[] = [];
      
      if (data) {
        Object.keys(data).forEach((key) => {
          loadedStaff.push({
            ...data[key],
            id: key,
          });
        });
      }
      
      set({ 
        staffList: loadedStaff.sort((a, b) => a.name.localeCompare(b.name)),
        loading: false, 
        error: null 
      });
    }, (error) => {
      set({ error: error.message, loading: false });
    });

    set({ unsubscribe });
    return () => unsubscribe();
  },

  addStaff: async (newStaff) => {
    set({ loading: true });
    try {
      const staffRef = ref(database, 'staff');
      const newStaffRef = push(staffRef);
      const staffWithId = { ...newStaff, id: newStaffRef.key as string };
      
      await firebaseSet(newStaffRef, staffWithId);
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateStaff: async (id, updates) => {
    set({ loading: true });
    try {
      const staffRef = ref(database, `staff/${id}`);
      await update(staffRef, updates);
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deleteStaff: async (id) => {
    set({ loading: true });
    try {
      const staffRef = ref(database, `staff/${id}`);
      await remove(staffRef);
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  }
}));
