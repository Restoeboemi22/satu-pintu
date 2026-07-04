import { create } from 'zustand';
import { Student } from '@/types/student';
import { database, db, ensureGasAuth } from '@/lib/firebase';
import { edulockAuth } from '@/lib/edulockFirebase';
import { useAuthStore } from '@/store/useAuthStore';
import { ref, onValue, update, get, query as rtdbQuery, orderByChild, equalTo, Unsubscribe } from 'firebase/database';
import { collection, query, where, getDocs, doc, writeBatch } from 'firebase/firestore';
import { callAdminApi } from '@/lib/callAdminApi';

interface StudentState {
  students: Student[];
  loading: boolean;
  error: string | null;
  unsubscribe: Unsubscribe | null;
  
  addStudent: (student: Omit<Student, "id">) => Promise<void>;
  addStudents: (students: Omit<Student, "id">[]) => Promise<void>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  deleteAllStudents: () => Promise<void>;
  getStudentById: (id: string) => Student | undefined;
  resetDevice: (id: string) => Promise<void>;
  // Simulation of App Login
  loginFromApp: (nisn: string, name: string, deviceId: string) => Promise<{ success: boolean; message: string }>;
  // Sync Data
  syncStudents: () => () => void; // Returns unsubscribe function
  refreshStudents: () => Promise<void>;
  lastSync: string | null;
  recoverFromFirestore: () => Promise<number>;
}

const getScopedStudentMeta = () => {
  const authUser = useAuthStore.getState().user;
  return {
    schoolId: String(authUser?.schoolId || "").trim(),
    schoolName: String(authUser?.schoolName || "").trim(),
    npsn: String(authUser?.npsn || "").trim(),
  };
};

const normalizeIdentity = (value: unknown) => String(value || "").trim();

const buildStudentPayload = (studentData: Omit<Student, "id"> | Partial<Student>, fallbackId: string) => {
  const nisn = String(studentData.nisn || fallbackId || "").trim();
  const meta = getScopedStudentMeta();
  const status = studentData.status || "active";

  return {
    ...studentData,
    id: nisn,
    nisn,
    schoolId: String(studentData.schoolId || meta.schoolId || "").trim(),
    schoolName: String(studentData.schoolName || meta.schoolName || "").trim(),
    npsn: String(studentData.npsn || meta.npsn || "").trim(),
    status,
  };
};

let sharedStudentUnsubscribe: Unsubscribe | null = null;
let sharedStudentSubscriberCount = 0;
let sharedStudentBootstrapping = false;

const buildStudentsRef = () => {
  const authUser = useAuthStore.getState().user;
  const scope = String(authUser?.schoolId || "").trim().toLowerCase();
  const isSuperAdmin = authUser?.role === "super_admin";

  return !isSuperAdmin && scope
    ? rtdbQuery(ref(database, "master_students"), orderByChild("schoolId"), equalTo(scope))
    : ref(database, "master_students");
};

const mapStudents = (data: unknown): Student[] => {
  if (!data || typeof data !== "object") return [];

  const list: Student[] = Object.entries(data)
    .map(([key, value]: any) => {
      const obj = value || {};
      const nisn = String(obj?.nisn || key || "").trim();
      const name = String(obj?.name || "").trim();
      if (!nisn || !name) return null;
      const statusRaw = String(obj?.status || "").trim().toLowerCase();
      return {
        id: nisn,
        nisn,
        name,
        class: obj?.class ? String(obj.class) : "",
        schoolId: obj?.schoolId ? String(obj.schoolId) : undefined,
        schoolName: obj?.schoolName ? String(obj.schoolName) : undefined,
        npsn: obj?.npsn ? String(obj.npsn) : undefined,
        gender: obj?.gender === "L" || obj?.gender === "P" ? obj.gender : undefined,
        religion: obj?.religion === "NON_ISLAM" ? "NON_ISLAM" : obj?.religion ? "ISLAM" : undefined,
        status: statusRaw === "nonaktif" ? "inactive" : "active",
        deviceId: obj?.deviceId ? String(obj.deviceId) : obj?.device ? String(obj.device) : null,
        username: obj?.username ? String(obj.username) : undefined,
        password: obj?.password ? String(obj.password) : undefined,
        lastLogin: obj?.lastLogin ? String(obj.lastLogin) : null,
      } as Student;
    })
    .filter(Boolean) as Student[];

  list.sort((a, b) => (a.class || "").localeCompare(b.class || "", "id-ID") || a.name.localeCompare(b.name, "id-ID"));
  return list;
};

const applyStudentSnapshot = (set: (partial: Partial<StudentState>) => void, data: unknown) => {
  set({
    students: mapStudents(data),
    loading: false,
    error: null,
    lastSync: new Date().toISOString(),
  });
};

export const useStudentStore = create<StudentState>()((set, get) => ({
  students: [],
  loading: false,
  error: null,
  unsubscribe: null,
  lastSync: null,
  
  recoverFromFirestore: async () => {
    set({ loading: true });
    try {
        const querySnapshot = await getDocs(collection(db, "students"));
        if (querySnapshot.empty) {
            set({ loading: false });
            return 0;
        }

        const updates: any = {};
        let count = 0;
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const username = data.username || data.id; // Fallback
            if (username) {
                // Construct Student Object
                // Mapping Firestore fields to RTDB Student format
                const student: Student = {
                    id: doc.id, // Use Firestore ID or generate new? Use Firestore ID for consistency if possible
                    username: data.username || "",
                    password: data.password || data.nisn || "",
                    name: data.fullName || data.name || data.nama || "",
                    nisn: data.nisn || data.nis || data.nisNip || "",
                    class: data.class || data.kelas || "",
                    religion: data.religion || data.agama || undefined,
                    isOnline: data.isOnline || false,
                    deviceId: data.deviceId || null,
                    lastLogin: data.lastLogin ? new Date(data.lastLogin).toISOString() : null
                };
                
                // Use username (sanitized) as key for RTDB to match Android convention?
                // Android uses: username.replace(".", "_") OR NISN
                // Let's use NISN if available, else sanitized username
                let key = student.nisn;
                if (!key && student.username) {
                    key = student.username.replace(/\./g, "_");
                }
                
                if (key) {
                    updates[`students/${key}`] = { ...student, id: key };
                    count++;
                }
            }
        });

        if (Object.keys(updates).length > 0) {
            await update(ref(database), updates);
        }
        
        set({ loading: false });
        return count;
    } catch (error: any) {
        console.error("Error recovering from Firestore:", error);
        set({ error: error.message, loading: false });
        return 0;
    }
  },

  syncStudents: () => {
    sharedStudentSubscriberCount += 1;

    if (sharedStudentUnsubscribe || sharedStudentBootstrapping) {
      return () => {
        sharedStudentSubscriberCount = Math.max(0, sharedStudentSubscriberCount - 1);
        if (sharedStudentSubscriberCount === 0 && sharedStudentUnsubscribe) {
          try {
            sharedStudentUnsubscribe();
          } catch {}
          sharedStudentUnsubscribe = null;
          set({ unsubscribe: null });
        }
      };
    }

    sharedStudentBootstrapping = true;
    set({ loading: true, error: null });

    void ensureGasAuth()
      .then(() => {
        const studentsRef = buildStudentsRef();
        sharedStudentUnsubscribe = onValue(
          studentsRef,
          (snapshot) => {
            applyStudentSnapshot(set, snapshot.val());
          },
          (error) => {
            console.error("Error fetching students:", error);
            set({ error: error.message, loading: false });
          }
        );

        sharedStudentBootstrapping = false;
        set({ unsubscribe: sharedStudentUnsubscribe });

        if (sharedStudentSubscriberCount === 0 && sharedStudentUnsubscribe) {
          try {
            sharedStudentUnsubscribe();
          } catch {}
          sharedStudentUnsubscribe = null;
          set({ unsubscribe: null });
        }
      })
      .catch((err: any) => {
        sharedStudentBootstrapping = false;
        console.error("Firebase connection error:", err);
        set({ error: err.message, loading: false, unsubscribe: null });
      });

    return () => {
      sharedStudentSubscriberCount = Math.max(0, sharedStudentSubscriberCount - 1);
      if (sharedStudentSubscriberCount === 0 && sharedStudentUnsubscribe) {
        try {
          sharedStudentUnsubscribe();
        } catch {}
        sharedStudentUnsubscribe = null;
        set({ unsubscribe: null });
      }
    };
  },

  refreshStudents: async () => {
    set({ loading: true, error: null });
    try {
      await ensureGasAuth();
      const snapshot = await get(buildStudentsRef());
      applyStudentSnapshot(set, snapshot.val());
    } catch (error: any) {
      console.error("Error refreshing students:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  addStudent: async (studentData) => {
    try {
      const nisn = String(studentData.nisn || "").trim();
      if (!nisn) {
        throw new Error("NISN wajib diisi");
      }
      const payload = buildStudentPayload(studentData, nisn);
      await callAdminApi("/api/admin/students", "POST", {
        nisn,
        name: payload.name,
        gender: payload.gender || "",
        religion: payload.religion || "",
        className: payload.class || "",
        status: payload.status === "inactive" ? "Nonaktif" : "Aktif",
      });
    } catch (error) {
        console.error("Error adding student:", error);
        throw error;
    }
  },

  addStudents: async (studentsData) => {
    try {
      const currentUser = edulockAuth.currentUser;
      if (!currentUser) {
        throw new Error("Sesi admin tidak aktif. Silakan login ulang.");
      }

      const rows = studentsData
        .map((student) => {
          const payload = buildStudentPayload(student, String(student.nisn || "").trim());
          const nisn = String(payload.nisn || "").trim();
          if (!nisn) return null;
          return {
            nisn,
            name: String(payload.name || "").trim(),
            gender: payload.gender === "P" ? "P" : "L",
            religion: payload.religion === "NON_ISLAM" ? "NON_ISLAM" : "ISLAM",
            className: String(payload.class || "").trim(),
            status: payload.status === "inactive" ? "Nonaktif" : "Aktif",
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row?.nisn && row?.name && row?.className));

      if (rows.length === 0) {
        throw new Error("Tidak ada data siswa valid untuk diimpor.");
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch("/api/admin/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          action: "bulk-import",
          rows,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success === false) {
        throw new Error(String(result?.message || "Import massal siswa gagal diproses."));
      }
    } catch (error) {
        console.error("Error adding students:", error);
        throw error;
    }
  },

  updateStudent: async (id, updatedData) => {
    try {
        const nextId = String(updatedData.nisn || id || "").trim();
        if (!nextId) {
            throw new Error("NISN wajib diisi");
        }
        const payload = buildStudentPayload(updatedData, nextId);
        await callAdminApi("/api/admin/students", "PUT", {
          nisn: nextId,
          previousNisn: id && id !== nextId ? String(id || "").trim() : undefined,
          name: payload.name,
          gender: payload.gender || "",
          religion: payload.religion || "",
          className: payload.class || "",
          status: payload.status === "inactive" ? "Nonaktif" : "Aktif",
        });
    } catch (error) {
        console.error("Error updating student:", error);
        throw error;
    }
  },

  deleteStudent: async (id) => {
    try {
        const nisn = String(id || "").trim();
        if (!nisn) return;
        await callAdminApi("/api/admin/students", "DELETE", {
          nisn,
        });
    } catch (error) {
        console.error("Error deleting student:", error);
        throw error;
    }
  },

  deleteAllStudents: async () => {
    try {
        await callAdminApi("/api/admin/students", "DELETE", {
          action: "delete-all",
        });
    } catch (error) {
        console.error("Error deleting all students:", error);
        throw error;
    }
  },

  getStudentById: (id) => {
    const normalizedId = normalizeIdentity(id);
    return get().students.find((student) =>
      [normalizeIdentity(student.id), normalizeIdentity(student.nisn)]
        .filter(Boolean)
        .includes(normalizedId)
    );
  },

  resetDevice: async (id) => {
     try {
        const state = get();
        const student = state.students.find(s => s.id === id);

        if (!student) {
            await callAdminApi("/api/admin/students", "DELETE", {
              action: "reset-device",
              nisn: String(id || "").trim(),
            });
            return;
        }
        const nisn = String(student.nisn || student.id || "").trim();
        await callAdminApi("/api/admin/students", "DELETE", {
          action: "reset-device",
          nisn,
        });

        if (db) {
            try {
                const batch = writeBatch(db);
                let batchCount = 0;
                const studentsRef = collection(db, 'students');
                const processedIds = new Set<string>();

                // Helper to add to batch safely
                const addToBatch = async (q: any) => {
                    const snap = await getDocs(q);
                    snap.forEach((docSnap) => {
                         if (!processedIds.has(docSnap.id)) {
                             batch.update(docSnap.ref, { 
                                 deviceId: null, 
                                 lastLogin: null,
                                 deviceStatus: "Offline", // Reset status
                                 isOnline: false
                             });
                             processedIds.add(docSnap.id);
                             batchCount++;
                         }
                    });
                };

                // Query by Username
                if (username) {
                    await addToBatch(query(studentsRef, where("username", "==", username)));
                }
                
                // Query by NISN
                if (nisn) {
                    await addToBatch(query(studentsRef, where("nisn", "==", nisn)));
                }

                // 6. Direct Document Access (Very Aggressive)
                // Android findStudentDocument uses ID directly as priority
                const directReset = async (docId: string) => {
                    if (!processedIds.has(docId)) {
                        try {
                            const dRef = doc(db, 'students', docId);
                            batch.update(dRef, { 
                                deviceId: null, 
                                lastLogin: null,
                                deviceStatus: "Offline",
                                isOnline: false
                            });
                            processedIds.add(docId);
                            batchCount++;
                        } catch (e) {}
                    }
                };

                if (username) await directReset(username);
                if (nisn) await directReset(nisn);
                // Try legacy username format too
                if (username && username.includes('.')) {
                    await directReset(username.replace(/\./g, "_"));
                }

                if (batchCount > 0) {
                    await batch.commit();
                }
            } catch (fsError) {
                console.error("Firestore Reset Error (Non-fatal):", fsError);
            }
        }

     } catch (error) {
        console.error("Error resetting device:", error);
        throw error;
     }
  },

  loginFromApp: async (nisn, name, deviceId) => {
      // Logic for login, utilizing Firebase
      // Note: In a real app, this should be a server-side API or Cloud Function for security.
      // But for this dashboard/client-side logic:
      
      const state = get();
      // We rely on the local synced state for finding the student quickly
      const student = state.students.find(s => s.nisn === nisn);

      if (!student) {
        return { success: false, message: "NISN tidak ditemukan" };
      }

      if (student.deviceId && student.deviceId !== deviceId) {
        return { success: false, message: "Akun terkunci di perangkat lain. Hubungi admin untuk reset." };
      }

      try {
           const now = new Date().toISOString();
           const updates: Record<string, any> = {
             [`master_students/${student.id}/lastLogin`]: now,
             [`students/${student.id}/lastLogin`]: now,
           };
           if (!student.deviceId) {
             updates[`master_students/${student.id}/deviceId`] = deviceId;
             updates[`master_students/${student.id}/device`] = deviceId;
             updates[`students/${student.id}/deviceId`] = deviceId;
           }
           await update(ref(database), updates);
           return { success: true, message: "Login Berhasil" };
      } catch (error: any) {
           return { success: false, message: "Error login: " + error.message };
      }
  },
}));
