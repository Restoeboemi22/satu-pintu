import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { database } from '@/lib/firebase';
import { useAuthStore } from '@/store/useAuthStore';
import { equalTo, get, onValue, orderByChild, query as rtdbQuery, ref, remove, Unsubscribe } from 'firebase/database';

export type RuleCategory = 'VIOLATION' | 'ACHIEVEMENT';
export type RuleSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RecordStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface DisciplineRule {
  id: number;
  ruleName: string;
  category: RuleCategory;
  points: number;
  severity: RuleSeverity;
  description: string | null;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DisciplineRecord {
  id: string | number;
  schoolId?: string;
  studentId: string;
  studentNameSnapshot?: string;
  classNameSnapshot?: string;
  ruleId: number;
  ruleNameSnapshot?: string;
  date: number; // Timestamp
  points: number;
  description: string | null;
  evidence: string | null;
  recordedBy: number | null | string;
  reportedByUserId?: string;
  reportedByName?: string;
  reportedByRole?: string;
  sourceApp?: string;
  followUpStatus?: string;
  followUpNote?: string | null;
  status: RecordStatus;
  createdAt: number;
  updatedAt: number;
}

// Helper type for UI display
export interface DisciplineRecordWithRule extends DisciplineRecord {
  rule?: DisciplineRule;
}

interface DisciplineStore {
  rules: DisciplineRule[];
  records: DisciplineRecord[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setRules: (rules: DisciplineRule[]) => void;
  setRecords: (records: DisciplineRecord[]) => void;
  addRecord: (record: DisciplineRecord) => void;
  
  // Sync
  syncAndroidDiscipline: (newRecords: DisciplineRecord[], newRules?: DisciplineRule[]) => void;
  initDisciplineSync: (schoolId?: string) => Unsubscribe;
  
  // Danger Zone
  deleteAllRecords: () => Promise<void>;
  
  // Getters
  getRecordsByStudentId: (studentId: string) => DisciplineRecordWithRule[];
  getRuleById: (ruleId: number) => DisciplineRule | undefined;
}

// Initial Data Seeding (Standard School Rules)
const initialRules: DisciplineRule[] = [
  { id: 1, ruleName: "Terlambat Sekolah", category: "VIOLATION", points: 5, severity: "LOW", description: "Datang ke sekolah setelah bel masuk berbunyi (07.00 WIB)", isActive: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 2, ruleName: "Atribut Tidak Lengkap", category: "VIOLATION", points: 5, severity: "LOW", description: "Tidak memakai topi, dasi, atau kaos kaki sesuai ketentuan", isActive: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 3, ruleName: "Seragam Tidak Rapi", category: "VIOLATION", points: 5, severity: "LOW", description: "Baju tidak dimasukkan (putra) atau tidak sesuai jadwal", isActive: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 4, ruleName: "Rambut Panjang (Putra)", category: "VIOLATION", points: 10, severity: "LOW", description: "Rambut menyentuh kerah baju atau menutupi telinga/alis", isActive: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 5, ruleName: "Membuang Sampah Sembarangan", category: "VIOLATION", points: 5, severity: "LOW", description: "Tidak membuang sampah pada tempat yang disediakan", isActive: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 11, ruleName: "Bolos Pelajaran", category: "VIOLATION", points: 20, severity: "MEDIUM", description: "Meninggalkan kelas saat jam pelajaran tanpa ijin", isActive: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 12, ruleName: "Pulang Awal", category: "VIOLATION", points: 20, severity: "MEDIUM", description: "Pulang sebelum waktunya tanpa ijin resmi dari sekolah atau guru", isActive: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 13, ruleName: "Merusak Fasilitas Sekolah", category: "VIOLATION", points: 25, severity: "MEDIUM", description: "Mencoret meja/dinding atau merusak alat sekolah", isActive: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 14, ruleName: "Berkata Kotor/Kasar", category: "VIOLATION", points: 15, severity: "MEDIUM", description: "Mengucapkan kata-kata tidak pantas kepada teman/guru", isActive: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 21, ruleName: "Merokok/Vape", category: "VIOLATION", points: 50, severity: "HIGH", description: "Merokok atau membawa rokok/vape di lingkungan sekolah", isActive: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 22, ruleName: "Berkelahi", category: "VIOLATION", points: 75, severity: "HIGH", description: "Melakukan perkelahian fisik dengan teman", isActive: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 23, ruleName: "Bullying/Perundungan", category: "VIOLATION", points: 75, severity: "HIGH", description: "Melakukan perundungan fisik atau verbal", isActive: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 24, ruleName: "Membawa Senjata Tajam", category: "VIOLATION", points: 100, severity: "CRITICAL", description: "Membawa senjata tajam yang membahayakan", isActive: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 51, ruleName: "Juara Lomba Sekolah", category: "ACHIEVEMENT", points: 15, severity: "LOW", description: "Juara 1/2/3 lomba tingkat sekolah (Class Meeting dll)", isActive: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 52, ruleName: "Juara Lomba Kabupaten", category: "ACHIEVEMENT", points: 25, severity: "MEDIUM", description: "Mewakili sekolah dan juara di tingkat kabupaten", isActive: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 53, ruleName: "Petugas Upacara", category: "ACHIEVEMENT", points: 5, severity: "LOW", description: "Menjadi petugas upacara bendera hari Senin", isActive: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 54, ruleName: "Hafalan Al-Quran", category: "ACHIEVEMENT", points: 20, severity: "MEDIUM", description: "Menyelesaikan hafalan Juz 30 atau surat pilihan", isActive: true, createdAt: Date.now(), updatedAt: Date.now() }
];

const initialRecords: DisciplineRecord[] = [];

export const DISCIPLINE_RULES_BY_SCHOOL_ROOT = "discipline_rules_by_school";

const normalizeSchoolScope = (schoolId?: string) => String(schoolId || "").trim().toLowerCase();
const normalizeIdentity = (value: unknown) => String(value || '').trim();

const toRuleArray = (data: unknown): DisciplineRule[] => {
  if (!data || typeof data !== "object") return [];
  return Object.entries(data as Record<string, any>).map(([key, value]) => ({
    ...value,
    id: Number(value?.id ?? key),
  })) as DisciplineRule[];
};

const pickRules = (scopedRules: DisciplineRule[], defaultRules: DisciplineRule[]) => {
  if (scopedRules.length > 0) return scopedRules;
  if (defaultRules.length > 0) return defaultRules;
  return initialRules;
};

export const useDisciplineStore = create<DisciplineStore>()(
  persist(
    (set, get) => ({
      rules: initialRules,
      records: initialRecords,
      isLoading: false,
      error: null,

      setRules: (rules) => set({ rules }),
      setRecords: (records) => set({ records }),
      addRecord: (record) => set((state) => ({ records: [...state.records, record] })),

      syncAndroidDiscipline: (newRecords, newRules) => {
        set((state) => {
          const currentRecords = [...state.records];
          let currentRules = [...state.rules];

          // Sync Rules if provided
          if (newRules) {
            newRules.forEach(newRule => {
              const index = currentRules.findIndex(r => r.id === newRule.id);
              if (index !== -1) {
                currentRules[index] = newRule;
              } else {
                currentRules.push(newRule);
              }
            });
          }

          // Sync Records
          newRecords.forEach(newRecord => {
            const index = currentRecords.findIndex(r => r.id === newRecord.id);
            if (index !== -1) {
              currentRecords[index] = newRecord;
            } else {
              currentRecords.push(newRecord);
            }
          });

          return { 
            records: currentRecords,
            rules: currentRules
          };
        });
      },

      initDisciplineSync: (schoolId?: string) => {
        const authUser = useAuthStore.getState().user;
        const scopedSchoolId = normalizeSchoolScope(schoolId || authUser?.schoolId);
        const isSuperAdmin = authUser?.role === 'super_admin';
        if (!isSuperAdmin && !scopedSchoolId) {
          set({ records: [], rules: initialRules, isLoading: false, error: "Konteks sekolah tidak tersedia." });
          return () => {};
        }

        const recordsRef =
          !isSuperAdmin && scopedSchoolId
            ? rtdbQuery(ref(database, 'discipline_records'), orderByChild('schoolId'), equalTo(scopedSchoolId))
            : ref(database, 'discipline_records');
        const rulesRef = ref(database, 'discipline_rules');
        const scopedRulesRef = scopedSchoolId
          ? ref(database, `${DISCIPLINE_RULES_BY_SCHOOL_ROOT}/${scopedSchoolId}`)
          : null;
        let defaultRulesCache: DisciplineRule[] = [];
        let scopedRulesCache: DisciplineRule[] = [];

        const applyRules = () => {
          set({ rules: pickRules(scopedRulesCache, defaultRulesCache) });
        };

        const unsubscribeRules = onValue(rulesRef, (snapshot) => {
          defaultRulesCache = toRuleArray(snapshot.val());
          applyRules();
        });

        const unsubscribeScopedRules = scopedRulesRef
          ? onValue(scopedRulesRef, (snapshot) => {
              scopedRulesCache = toRuleArray(snapshot.val());
              applyRules();
            })
          : () => {};

        const unsubscribeRecords = onValue(recordsRef, (snapshot) => {
          const data = snapshot.val();
          if (!data || typeof data !== "object") {
            set({ records: [] });
            return;
          }

          const syncedRecords = Object.entries(data).map(([key, value]: [string, any]) => ({
            ...value,
            id: value?.id ?? key
          }))
            .filter((record) => {
              if (isSuperAdmin) return true;
              return normalizeSchoolScope(record.schoolId) === scopedSchoolId;
            }) as DisciplineRecord[];

          set({ records: syncedRecords });
        });

        return () => {
          unsubscribeRules();
          unsubscribeScopedRules();
          unsubscribeRecords();
        };
      },

      deleteAllRecords: async () => {
        try {
            const authUser = useAuthStore.getState().user;
            const scopedSchoolId = normalizeSchoolScope(authUser?.schoolId);
            const isSuperAdmin = authUser?.role === 'super_admin';
            if (isSuperAdmin) {
              const recordsRef = ref(database, 'discipline_records');
              await remove(recordsRef);
              set({ records: [] });
              return;
            }
            if (!scopedSchoolId) {
              throw new Error("Konteks sekolah tidak tersedia.");
            }

            const snapshot = await get(
              rtdbQuery(ref(database, 'discipline_records'), orderByChild('schoolId'), equalTo(scopedSchoolId))
            );
            const data = snapshot.val();
            if (data && typeof data === 'object') {
              await Promise.all(
                Object.keys(data).map((key) => remove(ref(database, `discipline_records/${key}`)))
              );
            }
            set({ records: [] });
        } catch (error) {
            console.error("Error deleting all discipline records:", error);
            throw error;
        }
      },

      getRuleById: (ruleId) => get().rules.find(r => r.id === ruleId),

      getRecordsByStudentId: (studentId) => {
        const state = get();
        const normalizedStudentId = normalizeIdentity(studentId);
        return state.records
          .filter((record) => normalizeIdentity(record.studentId) === normalizedStudentId)
          .map(record => ({
            ...record,
            rule: state.rules.find(rule => rule.id === record.ruleId)
          }))
          .sort((a, b) => b.date - a.date);
      }
    }),
    {
      name: 'discipline-storage',
    }
  )
);
