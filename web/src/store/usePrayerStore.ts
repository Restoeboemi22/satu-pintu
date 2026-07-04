import { create } from "zustand";
import { database } from "@/lib/firebase";
import { useAuthStore } from "@/store/useAuthStore";
import { equalTo, onValue, orderByChild, query as rtdbQuery, ref, Unsubscribe } from "firebase/database";

export type PrayerStatus = "PRAY" | "NOT_PRAY" | "PERMIT" | "HALANGAN";

export interface PrayerLog {
  id: number | string;
  schoolId?: string;
  studentId: string;
  studentName?: string;
  date: number;
  status: PrayerStatus;
  notes?: string | null;
  recordedBy?: string | null;
  createdAt?: number;
  updatedAt?: number;
}

interface PrayerStore {
  logs: PrayerLog[];
  isLoading: boolean;
  error: string | null;
  initPrayerSync: (schoolId?: string) => Unsubscribe;
  getLogsByMonth: (month: number, year: number) => PrayerLog[];
}

function normalizeSchoolScope(value?: string) {
  return String(value || "").trim().toLowerCase();
}

export const usePrayerStore = create<PrayerStore>()((set, get) => ({
  logs: [],
  isLoading: false,
  error: null,

  initPrayerSync: (schoolId?: string) => {
    const authUser = useAuthStore.getState().user;
    const scopedSchoolId = normalizeSchoolScope(schoolId || authUser?.schoolId);
    const isSuperAdmin = authUser?.role === "super_admin";
    if (!isSuperAdmin && !scopedSchoolId) {
      set({ logs: [], isLoading: false, error: "Konteks sekolah tidak tersedia." });
      return () => {};
    }

    const prayerRef =
      !isSuperAdmin && scopedSchoolId
        ? rtdbQuery(ref(database, "prayer_attendance"), orderByChild("schoolId"), equalTo(scopedSchoolId))
        : ref(database, "prayer_attendance");
    set({ isLoading: true, error: null });
    return onValue(
      prayerRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data || typeof data !== "object") {
          set({ logs: [], isLoading: false, error: null });
          return;
        }
        const logs: PrayerLog[] = Object.keys(data)
          .map((key) => ({
            id: key,
            ...data[key],
          }))
          .filter((log) => {
            if (isSuperAdmin) return true;
            return normalizeSchoolScope(log.schoolId) === scopedSchoolId;
          });
        set({ logs, isLoading: false, error: null });
      },
      (err) => {
        set({ error: String((err as any)?.message || err), isLoading: false });
      }
    );
  },

  getLogsByMonth: (month, year) => {
    const startOfMonth = new Date(year, month - 1, 1).getTime();
    const endOfMonth = new Date(year, month, 0, 23, 59, 59).getTime();
    return get().logs.filter((log) => log.date >= startOfMonth && log.date <= endOfMonth);
  },
}));
