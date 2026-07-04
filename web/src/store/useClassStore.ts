import { create } from "zustand";
import { onValue, ref, Unsubscribe } from "firebase/database";
import { database, ensureGasAuth } from "@/lib/firebase";

export interface ClassData {
  id: string;
  name: string; // e.g., "VII-A"
  grade: string; // e.g., "VII", "VIII", "IX"
  description?: string;
}

interface ClassState {
  classes: ClassData[];
  loading: boolean;
  error: string | null;
  unsubscribe: Unsubscribe | null;

  subscribeToClasses: (schoolId: string) => Unsubscribe;
  getClassesByGrade: (grade: string) => ClassData[];
}

function normalize(value: unknown): string {
  return String(value || "").trim();
}

function toRomanGrade(value: unknown): "VII" | "VIII" | "IX" | "" {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "7" || raw === "VII") return "VII";
  if (raw === "8" || raw === "VIII") return "VIII";
  if (raw === "9" || raw === "IX") return "IX";
  return "";
}

function gradeFromClassName(className: string): "VII" | "VIII" | "IX" | "" {
  const upper = normalize(className).toUpperCase();
  if (upper.startsWith("VIII")) return "VIII";
  if (upper.startsWith("VII")) return "VII";
  if (upper.startsWith("IX")) return "IX";
  const compact = upper.replace(/\s+/g, "").replace(/-/g, "");
  if (compact.startsWith("7")) return "VII";
  if (compact.startsWith("8")) return "VIII";
  if (compact.startsWith("9")) return "IX";
  return "";
}

function canonicalizeClassName(raw: unknown): string {
  const base = String(raw || "")
    .toUpperCase()
    .replace(/KELAS|CLASS/g, "")
    .trim();
  if (!base) return "";
  const m = base.match(/^(VIII|VII|IX|7|8|9)(?:\s*[-.]?\s*)?(.*)$/);
  if (!m) return base;
  const grade = toRomanGrade(m[1]);
  const suffix = normalize(m[2]).replace(/^\-+/, "");
  if (!grade) return base;
  if (!suffix) return grade;
  return `${grade}-${suffix}`;
}

function compareClassNames(a: string, b: string) {
  const gradeFrom = (name: string) => {
    const grade = gradeFromClassName(name);
    if (grade === "VII") return 7;
    if (grade === "VIII") return 8;
    if (grade === "IX") return 9;
    return 999;
  };

  const suffixFrom = (name: string) => {
    const raw = normalize(name).toUpperCase();
    const m = raw.match(/^(VIII|VII|IX)\s*[- ]?\s*(.*)$/);
    if (m) return String(m[2] || "").trim();
    const compact = raw.replace(/\s+/g, "").replace(/-/g, "");
    const m2 = compact.match(/^(7|8|9)(.*)$/);
    if (m2) return String(m2[2] || "").trim();
    return raw;
  };

  const ga = gradeFrom(a);
  const gb = gradeFrom(b);
  if (ga !== gb) return ga - gb;
  return suffixFrom(a).localeCompare(suffixFrom(b), "id-ID", { numeric: true, sensitivity: "base" });
}

function buildClassesFromStudentData(data: any, schoolId: string) {
  const byClass = new Map<string, ClassData>();
  const sid = normalize(schoolId).toLowerCase();

  Object.values(data || {}).forEach((student: any) => {
    const studentSchoolId = normalize(student?.schoolId).toLowerCase();
    if (sid && studentSchoolId && studentSchoolId !== sid) return;
    if (sid && !studentSchoolId) return;

    const className = canonicalizeClassName(student?.class || student?.className || student?.kelas);
    if (!className || byClass.has(className)) return;
    const grade = gradeFromClassName(className);
    byClass.set(className, {
      id: className,
      name: className,
      grade: grade || "VII",
    });
  });

  return Array.from(byClass.values()).sort((a, b) => compareClassNames(a.name, b.name));
}

function buildClassesFromDatabase(data: any, schoolId: string) {
  const sid = normalize(schoolId).toLowerCase();
  const byClass = new Map<string, ClassData>();

  Object.entries(data || {}).forEach(([key, v]: any) => {
    const obj = v || {};
    const className = canonicalizeClassName(obj?.class || obj?.className || key);
    if (!className) return;
    const rowSchoolId = normalize(obj?.schoolId).toLowerCase() || sid;
    if (sid && rowSchoolId && rowSchoolId !== sid) return;

    const gradeFromRow = toRomanGrade(obj?.grade);
    const grade = gradeFromRow || gradeFromClassName(className) || "VII";
    byClass.set(className, { id: className, name: className, grade });
  });

  return Array.from(byClass.values()).sort((a, b) => compareClassNames(a.name, b.name));
}

function buildMergedClasses(classData: any, studentData: any, schoolId: string) {
  const sid = normalize(schoolId).toLowerCase();
  const disabledSet = new Set<string>();
  const byClass = new Map<string, ClassData>();

  Object.entries(classData || {}).forEach(([key, v]: any) => {
    const obj = v || {};
    const className = canonicalizeClassName(obj?.class || obj?.className || key);
    if (!className) return;

    const rowSchoolId = normalize(obj?.schoolId).toLowerCase() || sid;
    if (sid && rowSchoolId && rowSchoolId !== sid) return;

    if (obj?.disabled) {
      disabledSet.add(normalize(className).toUpperCase());
      return;
    }

    const gradeFromRow = toRomanGrade(obj?.grade);
    const grade = gradeFromRow || gradeFromClassName(className) || "VII";
    byClass.set(className, { id: className, name: className, grade });
  });

  Object.values(studentData || {}).forEach((student: any) => {
    const studentSchoolId = normalize(student?.schoolId).toLowerCase();
    if (sid && studentSchoolId && studentSchoolId !== sid) return;
    if (sid && !studentSchoolId) return;

    const className = canonicalizeClassName(student?.class || student?.className || student?.kelas);
    if (!className) return;
    if (disabledSet.has(normalize(className).toUpperCase())) return;
    if (byClass.has(className)) return;

    const grade = gradeFromClassName(className) || "VII";
    byClass.set(className, { id: className, name: className, grade });
  });

  return Array.from(byClass.values()).sort((a, b) => compareClassNames(a.name, b.name));
}

export const useClassStore = create<ClassState>()((set, get) => ({
  classes: [],
  loading: false,
  error: null,
  unsubscribe: null,

  subscribeToClasses: (schoolId: string) => {
    const state = get();
    if (state.unsubscribe) state.unsubscribe();

    const rawSchoolId = normalize(schoolId);
    if (!rawSchoolId) {
      set({ classes: [], loading: false, error: null, unsubscribe: null });
      return () => {};
    }

    const sid = rawSchoolId.toLowerCase();
    set({ loading: true, error: null });
    let latestClassData: any = {};
    let latestStudentData: any = {};
    let cancelled = false;
    let unsubClasses: Unsubscribe = () => {};
    let unsubStudents: Unsubscribe = () => {};

    const syncMergedClasses = () => {
      if (cancelled) return;
      const hasClassData = latestClassData && typeof latestClassData === "object";
      const hasStudentData = latestStudentData && typeof latestStudentData === "object";
      if (!hasClassData && !hasStudentData) {
        set({ classes: [], loading: false, error: null });
        return;
      }
      const list = buildMergedClasses(latestClassData, latestStudentData, sid);
      set({ classes: list, loading: false, error: null });
    };

    void ensureGasAuth()
      .then(() => {
        if (cancelled) return;

        const classesRef = ref(database, `master_classes/${rawSchoolId}`);
        const studentsRef = ref(database, "master_students");

        unsubClasses = onValue(
          classesRef,
          (snapshot) => {
            latestClassData = snapshot.val() || {};
            syncMergedClasses();
          },
          (error) => {
            if (cancelled) return;
            set({ error: error.message, loading: false, classes: [] });
          },
        );

        unsubStudents = onValue(
          studentsRef,
          (studentSnap) => {
            latestStudentData = studentSnap.val() || {};
            syncMergedClasses();
          },
          (error) => {
            if (cancelled) return;
            set({ error: error.message, loading: false, classes: [] });
          },
        );
      })
      .catch((error: any) => {
        if (cancelled) return;
        set({ error: error.message, loading: false, classes: [] });
      });

    const unsubAll: Unsubscribe = () => {
      cancelled = true;
      try {
        unsubClasses();
      } catch {}
      try {
        unsubStudents();
      } catch {}
    };

    set({ unsubscribe: unsubAll });
    return unsubAll;
  },

  getClassesByGrade: (grade) => 
    get().classes.filter(c => c.grade === grade),
}));
