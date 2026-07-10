import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { database } from '@/lib/firebase';
import { equalTo, onValue, orderByChild, query as rtdbQuery, ref, remove, Unsubscribe } from 'firebase/database';
import { callAdminApi } from '@/lib/callAdminApi';
import { useAuthStore } from '@/store/useAuthStore';

export interface AttendanceLog {
  id: number | string;
  schoolId?: string;
  studentId: string; // Changed from number to string to match Student.id
  studentName?: string;
  date: number; // Timestamp
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'SICK' | 'PERMIT';
  checkInTime: string | null;
  checkOutTime: string | null; // Added field
  checkInMethod: string | null;
  notes: string | null;
  proofDocument: string | null;
  recordedBy: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface DailySchedule {
  dayId: number; // 0=Sunday, 1=Monday, ...
  dayName: string;
  isEnabled: boolean;
  entryTime: string;
  exitTime: string;
}

export interface Holiday {
  id: string;
  date: string;
  description: string;
}

export interface SchoolLocation {
  latitude: number;
  longitude: number;
  radius: number;
}

interface AttendanceStore {
  schoolContextId: string;
  logs: AttendanceLog[];
  isLoading: boolean;
  error: string | null;
  attendanceLog: AttendanceLog[]; // For compatibility with SimulationCard
  schedules: DailySchedule[];
  prayerSchedules: DailySchedule[];
  holidays: Holiday[];
  location: SchoolLocation;
  mushollaLocation: SchoolLocation;
  
  // Actions
  setSchoolContext: (schoolId: string) => void;
  addLog: (log: AttendanceLog) => void;
  setLogs: (logs: AttendanceLog[]) => void;
  syncAndroidLogs: (newLogs: AttendanceLog[]) => void;
  getLogsByClassAndDate: (classId: string, month: number, year: number) => AttendanceLog[];
  updateSchedule: (dayId: number, updates: Partial<DailySchedule>) => void;
  updatePrayerSchedule: (dayId: number, updates: Partial<DailySchedule>) => void;
  initScheduleSync: () => Unsubscribe; // Firebase Sync
  initPrayerScheduleSync: () => Unsubscribe;
  initHolidaySync: () => Unsubscribe; // Firebase Holiday Sync
  initAttendanceSync: () => Unsubscribe; // Firebase Attendance Sync
  saveScheduleToFirebase: () => Promise<void>; // Manual Save to Firebase
  savePrayerScheduleToFirebase: () => Promise<void>;
  addHoliday: (holiday: Omit<Holiday, "id">) => Promise<void>;
  removeHoliday: (id: string) => Promise<void>;
  updateLocation: (updates: Partial<SchoolLocation>) => void;
  saveLocationToFirebase: () => Promise<void>;
  initLocationSync: () => Unsubscribe;
  updateMushollaLocation: (updates: Partial<SchoolLocation>) => void;
  saveMushollaLocationToFirebase: () => Promise<void>;
  initMushollaLocationSync: () => Unsubscribe;
  
  // Danger Zone
  deleteAllLogs: () => Promise<void>;

  // Simulation CheckIn
  checkIn: (studentId: string, studentName: string, lat: number, lng: number, isMock: boolean) => { success: boolean; message: string; distance?: number };
}

const normalizeSchoolScope = (value?: string) => String(value || "").trim().toLowerCase();

export const useAttendanceStore = create<AttendanceStore>()(
  persist(
    (set, get) => ({
      schoolContextId: "",
      logs: [],
      attendanceLog: [], // Initialize empty
      isLoading: false,
      error: null,
      schedules: [
        { dayId: 1, dayName: 'Senin', isEnabled: true, entryTime: '07:00', exitTime: '13:30' },
        { dayId: 2, dayName: 'Selasa', isEnabled: true, entryTime: '07:00', exitTime: '13:30' },
        { dayId: 3, dayName: 'Rabu', isEnabled: true, entryTime: '07:00', exitTime: '13:30' },
        { dayId: 4, dayName: 'Kamis', isEnabled: true, entryTime: '07:00', exitTime: '13:30' },
        { dayId: 5, dayName: 'Jumat', isEnabled: true, entryTime: '07:00', exitTime: '11:00' },
        { dayId: 6, dayName: 'Sabtu', isEnabled: true, entryTime: '07:00', exitTime: '12:00' },
        { dayId: 0, dayName: 'Minggu', isEnabled: false, entryTime: '00:00', exitTime: '00:00' },
      ],
      prayerSchedules: [
        { dayId: 1, dayName: 'Senin', isEnabled: true, entryTime: '12:00', exitTime: '12:30' },
        { dayId: 2, dayName: 'Selasa', isEnabled: true, entryTime: '12:00', exitTime: '12:30' },
        { dayId: 3, dayName: 'Rabu', isEnabled: true, entryTime: '12:00', exitTime: '12:30' },
        { dayId: 4, dayName: 'Kamis', isEnabled: true, entryTime: '12:00', exitTime: '12:30' },
        { dayId: 5, dayName: 'Jumat', isEnabled: true, entryTime: '11:30', exitTime: '12:15' },
        { dayId: 6, dayName: 'Sabtu', isEnabled: true, entryTime: '12:00', exitTime: '12:30' },
        { dayId: 0, dayName: 'Minggu', isEnabled: false, entryTime: '00:00', exitTime: '00:00' },
      ],
      holidays: [],
      location: { latitude: -7.6698, longitude: 112.5432, radius: 50 },
      mushollaLocation: { latitude: -7.6698, longitude: 112.5432, radius: 25 },

      setSchoolContext: (schoolId) => set({ schoolContextId: String(schoolId || "").trim().toLowerCase() }),

      addLog: (log) => set((state) => ({ 
        logs: [...state.logs, log],
        attendanceLog: [log, ...state.attendanceLog].slice(0, 10) // Keep recent logs
      })),
      
      setLogs: (logs) => set({ logs }),
      
      syncAndroidLogs: (newLogs) => {
        set((state) => {
          const currentLogs = [...state.logs];
          
          newLogs.forEach(newLog => {
            const index = currentLogs.findIndex(
              l => l.studentId === newLog.studentId && 
                   new Date(l.date).toDateString() === new Date(newLog.date).toDateString()
            );
            
            if (index !== -1) {
              currentLogs[index] = newLog;
            } else {
              currentLogs.push(newLog);
            }
          });
          
          return { logs: currentLogs };
        });
      },

      updateSchedule: (dayId, updates) => set((state) => ({
        schedules: state.schedules.map(s => s.dayId === dayId ? { ...s, ...updates } : s)
      })),

      updatePrayerSchedule: (dayId, updates) => set((state) => ({
        prayerSchedules: state.prayerSchedules.map(s => s.dayId === dayId ? { ...s, ...updates } : s)
      })),

      initScheduleSync: () => {
        const authUser = useAuthStore.getState().user;
        const scope = normalizeSchoolScope(get().schoolContextId || authUser?.schoolId);
        const scopedRef = scope ? ref(database, `school_settings/${scope}/attendance/schedules`) : null;
        const legacyRef = ref(database, "schedules");

        let scopedData: any = null;
        let legacyData: any = null;

        const applyFrom = (data: any) => {
          if (!data) return;
          const currentSchedules = get().schedules;
          const newSchedules = currentSchedules.map((localSchedule) => {
            const androidDayKey = localSchedule.dayId + 1;
            const remoteData = data[androidDayKey];
            if (remoteData) {
              return {
                ...localSchedule,
                entryTime: remoteData.startTime || localSchedule.entryTime,
                exitTime: remoteData.endTime || localSchedule.exitTime,
                isEnabled: !remoteData.isHoliday,
              };
            }
            return localSchedule;
          });
          set({ schedules: newSchedules });
        };

        const apply = () => {
          if (scopedData && typeof scopedData === "object" && Object.keys(scopedData).length > 0) {
            applyFrom(scopedData);
            return;
          }
          applyFrom(legacyData);
        };

        const unsubLegacy = onValue(legacyRef, (snapshot) => {
          legacyData = snapshot.val();
          apply();
        });

        const unsubScoped = scopedRef
          ? onValue(scopedRef, (snapshot) => {
              scopedData = snapshot.val();
              apply();
            })
          : (() => {}) as Unsubscribe;

        return () => {
          unsubLegacy();
          unsubScoped();
        };
      },

      initPrayerScheduleSync: () => {
        const authUser = useAuthStore.getState().user;
        const scope = normalizeSchoolScope(get().schoolContextId || authUser?.schoolId);
        const scopedRef = scope ? ref(database, `school_settings/${scope}/prayer/schedules`) : null;
        const legacyRef = ref(database, "prayer_schedules");

        let scopedData: any = null;
        let legacyData: any = null;

        const applyFrom = (data: any) => {
          if (!data) return;
          const currentSchedules = get().prayerSchedules;
          const newSchedules = currentSchedules.map((localSchedule) => {
            const androidDayKey = localSchedule.dayId + 1;
            const remoteData = data[androidDayKey];
            if (remoteData) {
              return {
                ...localSchedule,
                entryTime: remoteData.startTime || localSchedule.entryTime,
                exitTime: remoteData.endTime || localSchedule.exitTime,
                isEnabled: !remoteData.isHoliday,
              };
            }
            return localSchedule;
          });
          set({ prayerSchedules: newSchedules });
        };

        const apply = () => {
          if (scopedData && typeof scopedData === "object" && Object.keys(scopedData).length > 0) {
            applyFrom(scopedData);
            return;
          }
          applyFrom(legacyData);
        };

        const unsubLegacy = onValue(legacyRef, (snapshot) => {
          legacyData = snapshot.val();
          apply();
        });

        const unsubScoped = scopedRef
          ? onValue(scopedRef, (snapshot) => {
              scopedData = snapshot.val();
              apply();
            })
          : (() => {}) as Unsubscribe;

        return () => {
          unsubLegacy();
          unsubScoped();
        };
      },

      initHolidaySync: () => {
        const authUser = useAuthStore.getState().user;
        const scope = normalizeSchoolScope(get().schoolContextId || authUser?.schoolId);
        const scopedRef = scope ? ref(database, `school_settings/${scope}/attendance/holidays`) : null;
        const legacyRef = ref(database, "holidays");

        let scopedData: any = null;
        let legacyData: any = null;

        const normalizeHolidays = (data: any) => {
          if (!data || typeof data !== "object") return [] as Holiday[];
          return Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }));
        };

        const apply = () => {
          const scopedList = normalizeHolidays(scopedData);
          if (scopedList.length > 0) {
            set({ holidays: scopedList });
            return;
          }
          set({ holidays: normalizeHolidays(legacyData) });
        };

        const unsubLegacy = onValue(legacyRef, (snapshot) => {
          legacyData = snapshot.val();
          apply();
        });

        const unsubScoped = scopedRef
          ? onValue(scopedRef, (snapshot) => {
              scopedData = snapshot.val();
              apply();
            })
          : (() => {}) as Unsubscribe;

        return () => {
          unsubLegacy();
          unsubScoped();
        };
      },

      initAttendanceSync: () => {
        const authUser = useAuthStore.getState().user;
        const scope = normalizeSchoolScope(get().schoolContextId || authUser?.schoolId);
        const isSuperAdmin = authUser?.role === "super_admin";
        if (!isSuperAdmin && !scope) {
          set({ logs: [], attendanceLog: [], isLoading: false, error: "Konteks sekolah tidak tersedia." });
          return () => {};
        }

        const attendanceRef =
          !isSuperAdmin && scope
            ? rtdbQuery(ref(database, 'attendance'), orderByChild('schoolId'), equalTo(scope))
            : ref(database, 'attendance');
        return onValue(attendanceRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
             const logs: AttendanceLog[] = Object.keys(data)
               .map(key => ({
                 id: key,
                 ...data[key]
               }))
               .filter((log) => {
                 if (isSuperAdmin) return true;
                 return normalizeSchoolScope(log.schoolId) === scope;
               });
             set({ logs: logs, attendanceLog: logs.slice(0, 10), isLoading: false, error: null });
          } else {
             set({ logs: [], attendanceLog: [], isLoading: false, error: null });
          }
        });
      },

      saveScheduleToFirebase: async () => {
        const { schedules } = get();
        const authUser = useAuthStore.getState().user;
        const scope = normalizeSchoolScope(get().schoolContextId || authUser?.schoolId);

        await callAdminApi("/api/admin/attendance-settings", "POST", {
          action: "save-attendance-schedules",
          schoolId: scope || undefined,
          schedules,
        });
      },

      savePrayerScheduleToFirebase: async () => {
        const { prayerSchedules } = get();
        const authUser = useAuthStore.getState().user;
        const scope = normalizeSchoolScope(get().schoolContextId || authUser?.schoolId);
        await callAdminApi("/api/admin/attendance-settings", "POST", {
          action: "save-prayer-schedules",
          schoolId: scope || undefined,
          schedules: prayerSchedules,
        });
      },

      addHoliday: async (holiday) => {
        const authUser = useAuthStore.getState().user;
        const scope = normalizeSchoolScope(get().schoolContextId || authUser?.schoolId);
        await callAdminApi("/api/admin/attendance-settings", "POST", {
          action: "add-holiday",
          schoolId: scope || undefined,
          holiday,
        });
      },

      removeHoliday: async (id) => {
        const authUser = useAuthStore.getState().user;
        const scope = normalizeSchoolScope(get().schoolContextId || authUser?.schoolId);
        await callAdminApi("/api/admin/attendance-settings", "DELETE", {
          action: "remove-holiday",
          schoolId: scope || undefined,
          holiday: { id },
        });
      },

      updateLocation: (updates) => set((state) => ({
        location: { ...state.location, ...updates }
      })),

      saveLocationToFirebase: async () => {
        const { location } = get();
        const authUser = useAuthStore.getState().user;
        const scope = normalizeSchoolScope(get().schoolContextId || authUser?.schoolId);
        const latitude = Number((location as any)?.latitude);
        const longitude = Number((location as any)?.longitude);
        const radius = Number((location as any)?.radius);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(radius)) {
          throw new Error("Koordinat tidak valid. Pastikan Latitude/Longitude/Radius berisi angka (gunakan titik, bukan koma).");
        }
        await callAdminApi("/api/admin/attendance-settings", "POST", {
          action: "save-school-location",
          schoolId: scope || undefined,
          location: { latitude, longitude, radius },
        });
      },

      initLocationSync: () => {
        const authUser = useAuthStore.getState().user;
        const scope = normalizeSchoolScope(get().schoolContextId || authUser?.schoolId);
        const scopedRef = scope ? ref(database, `school_settings/${scope}/attendance/school_location`) : null;
        const legacyRef = ref(database, "school_location");

        let scopedData: any = null;
        let legacyData: any = null;

        const apply = () => {
          const data = scopedData && typeof scopedData === "object" ? scopedData : legacyData;
          if (!data) return;
          set({
            location: {
              latitude: data.latitude,
              longitude: data.longitude,
              radius: data.radius,
            },
          });
        };

        const unsubLegacy = onValue(legacyRef, (snapshot) => {
          legacyData = snapshot.val();
          apply();
        });

        const unsubScoped = scopedRef
          ? onValue(scopedRef, (snapshot) => {
              scopedData = snapshot.val();
              apply();
            })
          : (() => {}) as Unsubscribe;

        return () => {
          unsubLegacy();
          unsubScoped();
        };
      },

      updateMushollaLocation: (updates) => set((state) => ({
        mushollaLocation: { ...state.mushollaLocation, ...updates }
      })),

      saveMushollaLocationToFirebase: async () => {
        const { mushollaLocation } = get();
        const authUser = useAuthStore.getState().user;
        const scope = normalizeSchoolScope(get().schoolContextId || authUser?.schoolId);
        const latitude = Number((mushollaLocation as any)?.latitude);
        const longitude = Number((mushollaLocation as any)?.longitude);
        const radius = Number((mushollaLocation as any)?.radius);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(radius)) {
          throw new Error("Koordinat musholla tidak valid. Pastikan Latitude/Longitude/Radius berisi angka (gunakan titik, bukan koma).");
        }
        await callAdminApi("/api/admin/attendance-settings", "POST", {
          action: "save-musholla-location",
          schoolId: scope || undefined,
          location: { latitude, longitude, radius },
        });
      },

      initMushollaLocationSync: () => {
        const authUser = useAuthStore.getState().user;
        const scope = normalizeSchoolScope(get().schoolContextId || authUser?.schoolId);
        const scopedRef = scope ? ref(database, `school_settings/${scope}/prayer/musholla_location`) : null;
        const legacyRef = ref(database, "musholla_location");

        let scopedData: any = null;
        let legacyData: any = null;

        const apply = () => {
          const data = scopedData && typeof scopedData === "object" ? scopedData : legacyData;
          if (!data) return;
          set({
            mushollaLocation: {
              latitude: data.latitude,
              longitude: data.longitude,
              radius: data.radius,
            },
          });
        };

        const unsubLegacy = onValue(legacyRef, (snapshot) => {
          legacyData = snapshot.val();
          apply();
        });

        const unsubScoped = scopedRef
          ? onValue(scopedRef, (snapshot) => {
              scopedData = snapshot.val();
              apply();
            })
          : (() => {}) as Unsubscribe;

        return () => {
          unsubLegacy();
          unsubScoped();
        };
      },

      deleteAllLogs: async () => {
        try {
            const authUser = useAuthStore.getState().user;
            const schoolId = normalizeSchoolScope(get().schoolContextId || authUser?.schoolId);
            await callAdminApi("/api/admin/attendance-logs", "POST", {
              action: "delete-all",
              schoolId: schoolId || undefined,
            });
            set({ logs: [], attendanceLog: [] });
        } catch (error) {
            console.error("Error deleting all attendance logs:", error);
            throw error;
        }
      },

      getLogsByClassAndDate: (classId, month, year) => {
        // In a real app, this would filter by classId too (joining with student data)
        // Since store only has logs, we return all logs for the date range
        // The component will filter by class using student data
        const startOfMonth = new Date(year, month - 1, 1).getTime();
        const endOfMonth = new Date(year, month, 0, 23, 59, 59).getTime();

        return get().logs.filter(log => {
          return log.date >= startOfMonth && log.date <= endOfMonth;
        });
      },

      checkIn: (studentId, studentName, lat, lng, isMock) => {
        // Mock Implementation for Simulation
        const state = get();
        // Use location from state or default
        const schoolLat = state.location?.latitude ?? -7.6698;
        const schoolLng = state.location?.longitude ?? 112.5432;
        const radius = state.location?.radius ?? 50;
        
        // Haversine distance calculation
        const R = 6371e3; // metres
        const φ1 = lat * Math.PI/180;
        const φ2 = schoolLat * Math.PI/180;
        const Δφ = (schoolLat-lat) * Math.PI/180;
        const Δλ = (schoolLng-lng) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        if (isMock) {
          return { success: false, message: "Terdeteksi lokasi palsu (Mock Location).", distance: 0 };
        }

        // Validate Distance
        if (distance > radius) {
           return { success: false, message: `Jarak terlalu jauh (${Math.round(distance)}m). Maksimal ${radius}m.`, distance };
        }

        // Create a log entry
        const newLog: AttendanceLog = {
          id: Date.now(),
          studentId: studentId,
          studentName: studentName,
          date: Date.now(),
          status: 'PRESENT',
          checkInTime: new Date().toLocaleTimeString(),
          checkOutTime: null,
          checkInMethod: 'APP',
          notes: null,
          proofDocument: null,
          recordedBy: null,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        // Add to logs
        set((state) => ({
          logs: [...(state.logs || []), newLog],
          attendanceLog: [newLog, ...(state.attendanceLog || [])].slice(0, 10)
        }));

        return { success: true, message: "Check-in berhasil.", distance: distance };
      }
    }),
    {
      name: 'attendance-storage',
      version: 1, // Add versioning to force migration if needed in future
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // If we had a version 0 or no version, and we want to migrate
          // For now, just return persistedState as is, but ensuring logs exist
          return {
            ...persistedState,
            schoolContextId: persistedState.schoolContextId || "",
            logs: persistedState.logs || [],
            attendanceLog: persistedState.attendanceLog || [],
            location: persistedState.location || { latitude: -7.6698, longitude: 112.5432, radius: 50 },
            mushollaLocation: persistedState.mushollaLocation || { latitude: -7.6698, longitude: 112.5432, radius: 25 },
            prayerSchedules: persistedState.prayerSchedules || [
              { dayId: 1, dayName: 'Senin', isEnabled: true, entryTime: '12:00', exitTime: '12:30' },
              { dayId: 2, dayName: 'Selasa', isEnabled: true, entryTime: '12:00', exitTime: '12:30' },
              { dayId: 3, dayName: 'Rabu', isEnabled: true, entryTime: '12:00', exitTime: '12:30' },
              { dayId: 4, dayName: 'Kamis', isEnabled: true, entryTime: '12:00', exitTime: '12:30' },
              { dayId: 5, dayName: 'Jumat', isEnabled: true, entryTime: '11:30', exitTime: '12:15' },
              { dayId: 6, dayName: 'Sabtu', isEnabled: true, entryTime: '12:00', exitTime: '12:30' },
              { dayId: 0, dayName: 'Minggu', isEnabled: false, entryTime: '00:00', exitTime: '00:00' },
            ]
          };
        }
        return {
          ...persistedState,
          schoolContextId: persistedState.schoolContextId || "",
          prayerSchedules: persistedState.prayerSchedules || [
            { dayId: 1, dayName: 'Senin', isEnabled: true, entryTime: '12:00', exitTime: '12:30' },
            { dayId: 2, dayName: 'Selasa', isEnabled: true, entryTime: '12:00', exitTime: '12:30' },
            { dayId: 3, dayName: 'Rabu', isEnabled: true, entryTime: '12:00', exitTime: '12:30' },
            { dayId: 4, dayName: 'Kamis', isEnabled: true, entryTime: '12:00', exitTime: '12:30' },
            { dayId: 5, dayName: 'Jumat', isEnabled: true, entryTime: '11:30', exitTime: '12:15' },
            { dayId: 6, dayName: 'Sabtu', isEnabled: true, entryTime: '12:00', exitTime: '12:30' },
            { dayId: 0, dayName: 'Minggu', isEnabled: false, entryTime: '00:00', exitTime: '00:00' },
          ],
          mushollaLocation: persistedState.mushollaLocation || { latitude: -7.6698, longitude: 112.5432, radius: 25 },
        } as AttendanceStore;
      },
    }
  )
);
