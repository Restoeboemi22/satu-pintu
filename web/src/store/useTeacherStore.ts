import { create } from "zustand";
import { Teacher } from "@/types/teacher";
import { database, ensureGasAuth } from "@/lib/firebase";
import { useAuthStore } from "@/store/useAuthStore";
import { equalTo, onValue, orderByChild, push, query as rtdbQuery, ref, remove, set as firebaseSet, update } from "firebase/database";
import { callAdminApi } from "@/lib/callAdminApi";

interface TeacherState {
  teachers: Teacher[];
  loading: boolean;
  error: string | null;
  unsubscribe: (() => void) | null;

  subscribeToTeachers: () => () => void;
  addTeacher: (teacher: Omit<Teacher, "id">) => Promise<void>;
  updateTeacher: (id: string, updatedData: Partial<Teacher>) => Promise<void>;
  deleteTeacher: (id: string) => Promise<void>;
  getTeacherById: (id: string) => Teacher | undefined;
}

export const useTeacherStore = create<TeacherState>()((set, get) => ({
  teachers: [],
  loading: false,
  error: null,
  unsubscribe: null,

  subscribeToTeachers: () => {
    const state = get();
    if (state.unsubscribe) {
      try {
        state.unsubscribe();
      } catch {}
    }

    set({ loading: true, error: null });
    let cancelled = false;
    let activeUnsub = () => {};

    void ensureGasAuth()
      .then(() => {
        if (cancelled) return;

        const authUser = useAuthStore.getState().user;
        const scope = String(authUser?.schoolId || "").trim().toLowerCase();
        const isSuperAdmin = authUser?.role === "super_admin";
        if (!isSuperAdmin && !scope) {
          set({ teachers: [], loading: false, error: "Konteks sekolah tidak tersedia." });
          return;
        }

        const teachersRef =
          !isSuperAdmin && scope
            ? rtdbQuery(ref(database, 'master_teachers'), orderByChild('schoolId'), equalTo(scope))
            : ref(database, 'master_teachers');

        activeUnsub = onValue(teachersRef, (snapshot) => {
          if (cancelled) return;
          const data = snapshot.val();
          if (data) {
            const byNuptk = new Map<string, Teacher>();
            Object.entries(data).forEach(([key, value]: any) => {
              const obj = value || {};
              const nuptk = String(obj?.nuptk || key || "").trim();
              const name = String(obj?.name || obj?.nama || "").trim();
              const homeroomClass = String(obj?.homeroomClass || obj?.class || obj?.kelas || obj?.wali_kelas || "").trim();
              const status = obj?.status === "inactive" || obj?.status === "Nonaktif" ? "inactive" : "active";
              const teacher: Teacher = {
                id: nuptk || key,
                nuptk: nuptk || String(obj?.nuptk || ""),
                name,
                homeroomClass: homeroomClass || undefined,
                phone: String(obj?.phone || obj?.no_hp || ""),
                email: obj?.email ? String(obj.email) : "",
                status: obj?.status === "Nonaktif" ? "inactive" : status,
                deviceId: obj?.deviceId ? String(obj.deviceId) : null,
                schoolId: obj?.schoolId ? String(obj.schoolId) : undefined,
                schoolName: obj?.schoolName ? String(obj.schoolName) : undefined,
                npsn: obj?.npsn ? String(obj.npsn) : undefined,
                createdAt: typeof obj?.createdAt === "number" ? obj.createdAt : undefined,
                updatedAt: typeof obj?.updatedAt === "number" ? obj.updatedAt : undefined,
              };

              const mapKey = teacher.nuptk || teacher.id;
              if (!mapKey) return;
              const existing = byNuptk.get(mapKey);
              if (!existing) {
                byNuptk.set(mapKey, teacher);
                return;
              }
              byNuptk.set(mapKey, {
                ...existing,
                ...teacher,
                name: (existing.name || "").length >= (teacher.name || "").length ? existing.name : teacher.name,
                homeroomClass: existing.homeroomClass || teacher.homeroomClass,
                deviceId: existing.deviceId || teacher.deviceId,
                updatedAt: Math.max(Number(existing.updatedAt || 0), Number(teacher.updatedAt || 0)) || existing.updatedAt || teacher.updatedAt,
              });
            });
            const teacherList = Array.from(byNuptk.values())
              .filter((teacher) => isSuperAdmin || String(teacher.schoolId || "").trim().toLowerCase() === scope)
              .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            set({ teachers: teacherList, loading: false, error: null });
          } else {
            set({ teachers: [], loading: false, error: null });
          }
        }, (error) => {
          if (cancelled) return;
          console.error("Error fetching teachers:", error);
          set({ error: error.message, loading: false });
        });

        if (cancelled) {
          activeUnsub();
          return;
        }

        set({ unsubscribe: activeUnsub });
      })
      .catch((error: any) => {
        if (cancelled) return;
        console.error("Error preparing teacher sync:", error);
        set({ error: error.message, loading: false });
      });

    return () => {
      cancelled = true;
      try {
        activeUnsub();
      } catch {}
    };
  },

  addTeacher: async (teacherData) => {
    try {
      const nuptk = String((teacherData as any)?.nuptk || "").trim();
      if (!nuptk) throw new Error("NUPTK wajib diisi.");
      await callAdminApi("/api/admin/personnel", "POST", {
        entity: "teacher",
        nuptk,
        name: teacherData.name,
        className: teacherData.homeroomClass || "",
        status: teacherData.status === "inactive" ? "Nonaktif" : "Aktif",
      });
    } catch (error) {
      console.error("Error adding teacher:", error);
      throw error;
    }
  },

  updateTeacher: async (id, updatedData) => {
    try {
      await callAdminApi("/api/admin/personnel", "PUT", {
        entity: "teacher",
        nuptk: String((updatedData as any)?.nuptk || id || "").trim(),
        name: updatedData.name,
        className: updatedData.homeroomClass || "",
        status: updatedData.status === "inactive" ? "Nonaktif" : "Aktif",
      });
    } catch (error) {
      console.error("Error updating teacher:", error);
      throw error;
    }
  },

  deleteTeacher: async (id) => {
    try {
      await callAdminApi("/api/admin/personnel", "DELETE", {
        entity: "teacher",
        nuptk: String(id || "").trim(),
      });
    } catch (error) {
      console.error("Error deleting teacher:", error);
      throw error;
    }
  },

  getTeacherById: (id) => {
    return get().teachers.find((teacher) => teacher.id === id);
  },
}));
