import { create } from "zustand";
import { onValue, ref, Unsubscribe } from "firebase/database";
import { database } from "@/lib/firebase";
import { edulockAuth } from "@/lib/edulockFirebase";

export interface SchoolIdentity {
  name: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  logoUrl?: string;
}

export interface AcademicYear {
  id: string;
  name: string; // e.g., "2024/2025"
  semester: "Ganjil" | "Genap";
  isActive: boolean;
  startDate: string;
  endDate: string;
}

export interface TaskDefaults {
  defaultPoints: number;
  defaultDurationMinutes: number;
  autoPublish: boolean;
  reminderDays: number;
}

export interface LoanSettings {
  defaultLoanDays: number;
  maxActiveLoans: number;
  finePerDay: number;
  allowWeekendDueDate: boolean;
}

interface SettingsState {
  schoolIdentity: SchoolIdentity;
  academicYears: AcademicYear[];
  activeYearId: string | null;
  taskDefaults: TaskDefaults;
  loanSettings: LoanSettings;
  currentSchoolId: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
  lastSyncedAt: number | null;
  unsubscribe: Unsubscribe | null;

  subscribeToSchoolSettings: (schoolId: string, schoolName?: string) => Unsubscribe;
  saveSchoolIdentity: (schoolId: string) => Promise<void>;
  saveAcademicYears: (schoolId: string) => Promise<void>;
  saveTaskDefaults: (schoolId: string) => Promise<void>;
  saveLoanSettings: (schoolId: string) => Promise<void>;
  updateSchoolIdentity: (identity: Partial<SchoolIdentity>) => void;
  addAcademicYear: (year: AcademicYear) => void;
  updateAcademicYear: (id: string, patch: Partial<AcademicYear>) => void;
  setActiveYear: (id: string) => void;
  deleteAcademicYear: (id: string) => void;
  updateTaskDefaults: (patch: Partial<TaskDefaults>) => void;
  updateLoanSettings: (patch: Partial<LoanSettings>) => void;
  getActiveYear: () => AcademicYear | undefined;
}

interface LenteraSettingsPayload {
  schoolIdentity: SchoolIdentity;
  academicYears: AcademicYear[];
  activeYearId: string | null;
  taskDefaults: TaskDefaults;
  loanSettings: LoanSettings;
  updatedAt?: number;
}

function normalize(value: unknown): string {
  return String(value || "").trim();
}

function createDefaultAcademicYears(): { academicYears: AcademicYear[]; activeYearId: string } {
  const today = new Date();
  const year = today.getFullYear();
  const isFirstSemester = today.getMonth() >= 6;
  const startYear = isFirstSemester ? year : year - 1;
  const endYear = startYear + 1;
  const activeSemester: AcademicYear["semester"] = isFirstSemester ? "Ganjil" : "Genap";
  const activeId = `${startYear}-${activeSemester.toLowerCase()}`;

  return {
    academicYears: [
      {
        id: activeId,
        name: `${startYear}/${endYear}`,
        semester: activeSemester,
        isActive: true,
        startDate: "",
        endDate: "",
      },
    ],
    activeYearId: activeId,
  };
}

function createDefaultPayload(schoolName?: string): LenteraSettingsPayload {
  const defaultYears = createDefaultAcademicYears();
  return {
    schoolIdentity: {
      name: normalize(schoolName) || "Lentera Digital",
      address: "",
      email: "",
      phone: "",
      website: "",
    },
    academicYears: defaultYears.academicYears,
    activeYearId: defaultYears.activeYearId,
    taskDefaults: {
      defaultPoints: 30,
      defaultDurationMinutes: 45,
      autoPublish: false,
      reminderDays: 3,
    },
    loanSettings: {
      defaultLoanDays: 7,
      maxActiveLoans: 2,
      finePerDay: 1000,
      allowWeekendDueDate: false,
    },
    updatedAt: Date.now(),
  };
}

function mergePayload(data: Partial<LenteraSettingsPayload> | null | undefined, schoolName?: string): LenteraSettingsPayload {
  const fallback = createDefaultPayload(schoolName);
  const incomingIdentity = data?.schoolIdentity || {};
  const incomingYears = Array.isArray(data?.academicYears) ? data?.academicYears : [];
  const normalizedYears =
    incomingYears.length > 0
      ? incomingYears.map((year) => ({
          ...year,
          startDate: normalize(year?.startDate),
          endDate: normalize(year?.endDate),
        }))
      : fallback.academicYears;

  const activeYearId =
    normalize(data?.activeYearId) ||
    normalizedYears.find((year) => year.isActive)?.id ||
    fallback.activeYearId;

  return {
    schoolIdentity: {
      ...fallback.schoolIdentity,
      ...incomingIdentity,
      name: normalize(incomingIdentity.name) || fallback.schoolIdentity.name,
    },
    academicYears: normalizedYears.map((year) => ({
      ...year,
      isActive: year.id === activeYearId,
    })),
    activeYearId,
    taskDefaults: {
      ...fallback.taskDefaults,
      ...(data?.taskDefaults || {}),
    },
    loanSettings: {
      ...fallback.loanSettings,
      ...(data?.loanSettings || {}),
    },
    updatedAt: typeof data?.updatedAt === "number" ? data.updatedAt : Date.now(),
  };
}

async function writeSettingsSection(schoolId: string, patch: Partial<LenteraSettingsPayload>) {
  const sid = normalize(schoolId);
  if (!sid) throw new Error("schoolId tidak tersedia");
  const currentUser = edulockAuth.currentUser;
  if (!currentUser) {
    throw new Error("Sesi admin tidak aktif. Silakan login ulang.");
  }

  const idToken = await currentUser.getIdToken();
  const state = useSettingsStore.getState();
  const payload = mergePayload(
    {
      schoolIdentity: state.schoolIdentity,
      academicYears: state.academicYears,
      activeYearId: state.activeYearId,
      taskDefaults: state.taskDefaults,
      loanSettings: state.loanSettings,
      ...patch,
    },
    state.schoolIdentity?.name
  );

  const response = await fetch("/api/admin/lentera-settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      action: "save-settings",
      schoolId: sid,
      ...payload,
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.success === false) {
    throw new Error(String(result?.message || "Gagal menyimpan pengaturan Lentera."));
  }
}

export const useSettingsStore = create<SettingsState>()((set, get) => {
  const defaults = createDefaultPayload();

  return {
    schoolIdentity: defaults.schoolIdentity,
    academicYears: defaults.academicYears,
    activeYearId: defaults.activeYearId,
    taskDefaults: defaults.taskDefaults,
    loanSettings: defaults.loanSettings,
    currentSchoolId: "",
    loading: false,
    saving: false,
    error: null,
    lastSyncedAt: null,
    unsubscribe: null,

    subscribeToSchoolSettings: (schoolId, schoolName) => {
      const state = get();
      if (state.unsubscribe) {
        state.unsubscribe();
      }

      const sid = normalize(schoolId);
      if (!sid) {
        const fallback = createDefaultPayload(schoolName);
        set({
          ...fallback,
          currentSchoolId: "",
          loading: false,
          saving: false,
          error: null,
          lastSyncedAt: null,
          unsubscribe: null,
        });
        return () => {};
      }

      set({ loading: true, error: null, currentSchoolId: sid });
      const settingsRef = ref(database, `lentera_settings/${sid}`);

      const unsubscribe = onValue(
        settingsRef,
        (snapshot) => {
          const raw = snapshot.val();
          const merged = mergePayload(raw || undefined, schoolName);

          set({
            schoolIdentity: merged.schoolIdentity,
            academicYears: merged.academicYears,
            activeYearId: merged.activeYearId,
            taskDefaults: merged.taskDefaults,
            loanSettings: merged.loanSettings,
            loading: false,
            error: null,
            lastSyncedAt: merged.updatedAt || Date.now(),
          });
        },
        (error) => {
          set({
            loading: false,
            error: error.message,
          });
        },
      );

      set({ unsubscribe });
      return unsubscribe;
    },

    saveSchoolIdentity: async (schoolId) => {
      set({ saving: true, error: null });
      try {
        await writeSettingsSection(schoolId, {
          schoolIdentity: get().schoolIdentity,
        });
        set({ saving: false, lastSyncedAt: Date.now() });
      } catch (error: any) {
        set({ saving: false, error: error?.message || "Gagal menyimpan identitas Lentera" });
        throw error;
      }
    },

    saveAcademicYears: async (schoolId) => {
      set({ saving: true, error: null });
      try {
        await writeSettingsSection(schoolId, {
          academicYears: get().academicYears,
          activeYearId: get().activeYearId,
        });
        set({ saving: false, lastSyncedAt: Date.now() });
      } catch (error: any) {
        set({ saving: false, error: error?.message || "Gagal menyimpan tahun ajaran" });
        throw error;
      }
    },

    saveTaskDefaults: async (schoolId) => {
      set({ saving: true, error: null });
      try {
        await writeSettingsSection(schoolId, {
          taskDefaults: get().taskDefaults,
        });
        set({ saving: false, lastSyncedAt: Date.now() });
      } catch (error: any) {
        set({ saving: false, error: error?.message || "Gagal menyimpan pengaturan tugas" });
        throw error;
      }
    },

    saveLoanSettings: async (schoolId) => {
      set({ saving: true, error: null });
      try {
        await writeSettingsSection(schoolId, {
          loanSettings: get().loanSettings,
        });
        set({ saving: false, lastSyncedAt: Date.now() });
      } catch (error: any) {
        set({ saving: false, error: error?.message || "Gagal menyimpan pengaturan peminjaman" });
        throw error;
      }
    },

    updateSchoolIdentity: (identity) =>
      set((state) => ({ schoolIdentity: { ...state.schoolIdentity, ...identity } })),

    addAcademicYear: (year) =>
      set((state) => ({ academicYears: [...state.academicYears, year] })),

    updateAcademicYear: (id, patch) =>
      set((state) => ({
        academicYears: state.academicYears.map((year) =>
          year.id === id ? { ...year, ...patch, id: year.id } : year,
        ),
      })),

    setActiveYear: (id) =>
      set((state) => ({
        activeYearId: id,
        academicYears: state.academicYears.map((year) => ({
          ...year,
          isActive: year.id === id,
        })),
      })),

    deleteAcademicYear: (id) =>
      set((state) => ({
        academicYears: state.academicYears.filter((year) => year.id !== id),
        activeYearId: state.activeYearId === id ? null : state.activeYearId,
      })),

    updateTaskDefaults: (patch) =>
      set((state) => ({ taskDefaults: { ...state.taskDefaults, ...patch } })),

    updateLoanSettings: (patch) =>
      set((state) => ({ loanSettings: { ...state.loanSettings, ...patch } })),

    getActiveYear: () => {
      const state = get();
      return state.academicYears.find((year) => year.id === state.activeYearId);
    },
  };
});
