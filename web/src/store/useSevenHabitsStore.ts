import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { database } from '@/lib/firebase';
import { ref, onValue, Unsubscribe, set as firebaseSet } from 'firebase/database';
import { useAuthStore } from './useAuthStore';
import { useStudentStore } from './useStudentStore';
import { callAdminApi, hasEduLockAdminSession } from '@/lib/callAdminApi';
import { callPortalApi } from '@/lib/callPortalApi';

// Raw data structure from Android App (Room Entity)
export interface AndroidHabitLog {
  id: number;
  studentId: number;
  habitId: number; // 1-7
  date: number; // Timestamp (milliseconds)
  isCompleted: boolean;
  updatedAt: number;
}

// Dashboard display structure (Aggregated per day)
export interface HabitLog {
  id: string; // Unique ID for this daily record
  studentId: string;
  studentName: string;
  className: string;
  date: string; // YYYY-MM-DD
  week: number; // Week number of the month (1-4)
  month: number; // Month number (1-12)
  year: number; // Year
  habits: {
    habit1: boolean; // Bangun Pagi
    habit2: boolean; // Beribadah
    habit3: boolean; // Berolahraga
    habit4: boolean; // Makan Sehat dan Bergizi
    habit5: boolean; // Gemar Belajar
    habit6: boolean; // Bermasyarakat
    habit7: boolean; // Tidur Lebih Awal
  };
}

export const HABIT_NAMES = {
  habit1: "Bangun Pagi",
  habit2: "Beribadah",
  habit3: "Berolahraga",
  habit4: "Makan Sehat",
  habit5: "Gemar Belajar",
  habit6: "Bermasyarakat",
  habit7: "Tidur Awal"
};

export interface TeacherRubric {
  honesty: number; // 0-25
  behavior: number; // 0-25
  initiative: number; // 0-25
  commitment: number; // 0-25
  total: number; // 0-100
}

interface SevenHabitsState {
  logs: HabitLog[];
  teacherRatings: Record<string, TeacherRubric>; // Key format: "studentId_month_year"
  isLoading: boolean;
  
  addLog: (log: Omit<HabitLog, "id">) => void;
  setTeacherRating: (studentId: string, month: number, year: number, rubric: TeacherRubric) => Promise<void>;
  getLogsByStudent: (studentId: string) => HabitLog[];
  getLogsByClass: (className: string) => HabitLog[];
  // Sync function to process raw data from Android
  syncAndroidLogs: (androidLogs: AndroidHabitLog[], studentMap: Record<number, {name: string, class: string}>) => void;
  
  initSevenHabitsSync: () => Unsubscribe;
  toggleHabit: (studentId: string, date: string, habitKey: keyof HabitLog['habits'], value: boolean) => Promise<void>;
}

// Initial Mock Data (kept for fallback)
const initialLogs: HabitLog[] = [];

function normalizeIdentity(value: unknown) {
  return String(value || "").trim();
}

function buildTeacherRatingKey(studentId: string, month: number, year: number) {
  return `${normalizeIdentity(studentId)}_${month}_${year}`;
}

function resolveStudentMeta(studentId: string) {
  const authUser = useAuthStore.getState().user;
  const students = useStudentStore.getState().students;
  const requestedId = normalizeIdentity(studentId);
  const fallbackStudentId = normalizeIdentity(authUser?.nisn || authUser?.id || requestedId);

  const student = students.find((item) => {
    const id = normalizeIdentity(item.id);
    const nisn = normalizeIdentity(item.nisn);
    return id === requestedId || nisn === requestedId || id === fallbackStudentId || nisn === fallbackStudentId;
  });

  return {
    resolvedStudentId: normalizeIdentity(student?.id || student?.nisn || fallbackStudentId),
    studentName: normalizeIdentity(student?.name),
    className: normalizeIdentity(student?.class),
    schoolId: normalizeIdentity(student?.schoolId || authUser?.schoolId),
  };
}

export const useSevenHabitsStore = create<SevenHabitsState>()(
  persist(
    (set, get) => ({
      logs: initialLogs,
      teacherRatings: {},
      isLoading: true,

      toggleHabit: async (studentId, date, habitKey, value) => {
        const studentMeta = resolveStudentMeta(studentId);
        const requestedId = normalizeIdentity(studentId);
        const resolvedStudentId = studentMeta.resolvedStudentId || requestedId;
        let persistedLog: HabitLog | null = null;

        // Optimistic update
        set((state) => {
            const existingLogIndex = state.logs.findIndex((log) => {
                const currentId = normalizeIdentity(log.studentId);
                return log.date === date && (currentId === requestedId || currentId === resolvedStudentId);
            });
            if (existingLogIndex >= 0) {
                const newLogs = [...state.logs];
                const updatedLog: HabitLog = {
                    ...newLogs[existingLogIndex],
                    studentId: resolvedStudentId,
                    studentName: studentMeta.studentName || newLogs[existingLogIndex].studentName,
                    className: studentMeta.className || newLogs[existingLogIndex].className,
                    habits: {
                        ...newLogs[existingLogIndex].habits,
                        [habitKey]: value
                    }
                };
                newLogs[existingLogIndex] = updatedLog;
                persistedLog = updatedLog;
                return { logs: newLogs };
            } else {
                // Create new log if not exists
                // Note: We need to calculate week/month/year from date string
                const [y, m, d] = date.split('-').map(Number);
                const week = Math.ceil(d / 7); // Simplified week calc
                
                const newLog: HabitLog = {
                    id: Math.random().toString(36).substr(2, 9),
                    studentId: resolvedStudentId,
                    studentName: studentMeta.studentName,
                    className: studentMeta.className,
                    date,
                    week,
                    month: m,
                    year: y,
                    habits: {
                        habit1: false,
                        habit2: false,
                        habit3: false,
                        habit4: false,
                        habit5: false,
                        habit6: false,
                        habit7: false,
                        [habitKey]: value
                    }
                };
                persistedLog = newLog;
                return { logs: [...state.logs, newLog] };
            }
        });

        // Real-time update to Firebase
        try {
            const [y, m, d] = date.split('-').map(Number);
            const week = Math.ceil(d / 7);
            const logPayload = persistedLog || {
              id: Math.random().toString(36).substr(2, 9),
              studentId: resolvedStudentId,
              studentName: studentMeta.studentName,
              className: studentMeta.className,
              date,
              week,
              month: m,
              year: y,
              habits: {
                habit1: false,
                habit2: false,
                habit3: false,
                habit4: false,
                habit5: false,
                habit6: false,
                habit7: false,
                [habitKey]: value,
              },
            };

            if (hasEduLockAdminSession()) {
              await callAdminApi("/api/admin/seven-habits", "POST", {
                action: "toggle-habit",
                schoolId: studentMeta.schoolId || undefined,
                studentId: resolvedStudentId,
                date,
                habitKey,
                value,
              });
            } else {
              await callPortalApi("/api/portal/seven-habits", "POST", {
                action: "toggle-habit",
                studentId: resolvedStudentId,
                date,
                habitKey,
                value,
              });
            }
        } catch (error) {
            console.error("Error updating 7 Habits log:", error);
            // Revert logic could be added here
        }
      },

      addLog: (log) =>
        set((state) => ({
          logs: [
            ...state.logs,
            { ...log, id: Math.random().toString(36).substr(2, 9) },
          ],
        })),

      setTeacherRating: async (studentId, month, year, rubric) => {
        const studentMeta = resolveStudentMeta(studentId);
        const scopedSchoolId = studentMeta.schoolId || normalizeIdentity(useAuthStore.getState().user?.schoolId);
        const ratingKey = buildTeacherRatingKey(studentMeta.resolvedStudentId || studentId, month, year);
        const previousRating = get().teacherRatings[ratingKey];

        set((state) => ({
          teacherRatings: {
            ...state.teacherRatings,
            [ratingKey]: rubric,
          }
        }));

        try {
          if (!scopedSchoolId) {
            throw new Error("Konteks sekolah untuk nilai guru belum tersedia.");
          }

          if (hasEduLockAdminSession()) {
            await callAdminApi("/api/admin/seven-habits", "POST", {
              action: "set-teacher-rating",
              schoolId: scopedSchoolId,
              studentId: studentMeta.resolvedStudentId || studentId,
              month,
              year,
              rubric,
            });
          } else {
            await callPortalApi("/api/portal/seven-habits", "POST", {
              action: "set-teacher-rating",
              studentId: studentMeta.resolvedStudentId || studentId,
              month,
              year,
              rubric,
            });
          }
        } catch (error) {
          set((state) => {
            const nextRatings = { ...state.teacherRatings };
            if (previousRating) {
              nextRatings[ratingKey] = previousRating;
            } else {
              delete nextRatings[ratingKey];
            }
            return { teacherRatings: nextRatings };
          });
          throw error;
        }
      },

      getLogsByStudent: (studentId) => {
        return get().logs.filter((log) => String(log.studentId) === String(studentId));
      },

      getLogsByClass: (className) => {
        return get().logs.filter((log) => log.className === className);
      },

      syncAndroidLogs: (androidLogs, studentMap) => {
         // Legacy sync logic if needed
      },

      initSevenHabitsSync: () => {
        const habitsRef = ref(database, 'seven_habits_logs');
        const habitsUnsub = onValue(habitsRef, (snapshot) => {
           const data = snapshot.val();
           if (data) {
             const flattenedLogs: HabitLog[] = [];
             const students = useStudentStore.getState().students; // Access student store directly
             
             // Data is { studentId: { dateStr: LogObj } }
             Object.keys(data).forEach(key => {
               const studentLogs = data[key];
               
               // Find student info
               // The key might be NISN or Internal ID (depending on what Android sends)
               const student = students.find(s => s.nisn === key || s.id.toString() === key);
               const studentName = student?.name || "Unknown Student";
                const className = student?.class || "Unknown Class";
                const resolvedStudentId = student ? student.id : key;
                const resolvedStudentIdStr = String(resolvedStudentId);

               Object.keys(studentLogs).forEach(dateStr => {
                 const rawLog = studentLogs[dateStr];
                 // Parse date string manually to avoid timezone issues (YYYY-MM-DD)
                 // e.g. "2024-02-10" -> y=2024, m=2, d=10
                 const [y, m, d] = dateStr.split('-').map(Number);
                 
                 flattenedLogs.push({
                   id: rawLog.id || `sync_${key}_${dateStr}`,
                   studentId: resolvedStudentIdStr,
                   studentName: studentName,
                   className: className,
                   date: dateStr,
                   week: Math.ceil(d / 7),
                   month: m,
                   year: y,
                   habits: {
                      habit1: rawLog.habits?.habit1 || rawLog.habit1 || false,
                      habit2: rawLog.habits?.habit2 || rawLog.habit2 || false,
                      habit3: rawLog.habits?.habit3 || rawLog.habit3 || false,
                      habit4: rawLog.habits?.habit4 || rawLog.habit4 || false,
                      habit5: rawLog.habits?.habit5 || rawLog.habit5 || false,
                      habit6: rawLog.habits?.habit6 || rawLog.habit6 || false,
                      habit7: rawLog.habits?.habit7 || rawLog.habit7 || false
                   }
                 });
               });
             });
             
             set({ logs: flattenedLogs, isLoading: false });
           } else {
             set({ logs: [], isLoading: false });
           }
        });

        const schoolId = normalizeIdentity(useAuthStore.getState().user?.schoolId);
        if (!schoolId) {
          set({ teacherRatings: {} });
          return habitsUnsub;
        }

        const ratingsRef = ref(database, `seven_habits_teacher_ratings/${schoolId}`);
        const ratingsUnsub = onValue(ratingsRef, (snapshot) => {
          const rawRatings = snapshot.val();
          if (!rawRatings || typeof rawRatings !== "object") {
            set({ teacherRatings: {} });
            return;
          }

          const nextRatings: Record<string, TeacherRubric> = {};
          Object.entries(rawRatings).forEach(([key, value]) => {
            const rubric = value as Partial<TeacherRubric> | null;
            if (!rubric) return;
            nextRatings[key] = {
              honesty: Number(rubric.honesty || 0),
              behavior: Number(rubric.behavior || 0),
              initiative: Number(rubric.initiative || 0),
              commitment: Number(rubric.commitment || 0),
              total: Number(rubric.total || 0),
            };
          });
          set({ teacherRatings: nextRatings });
        });

        return () => {
          try {
            habitsUnsub();
          } catch {}
          try {
            ratingsUnsub();
          } catch {}
        };
      },
    }),
    {
      name: 'seven-habits-storage',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') {
          return localStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
    }
  )
);
