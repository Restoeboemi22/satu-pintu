import { create } from 'zustand';
import { database, db } from '@/lib/firebase';
import { useAuthStore } from '@/store/useAuthStore';
import { equalTo, onValue, orderByChild, push, query as rtdbQuery, ref, set as firebaseSet, update, get as firebaseGet, remove } from 'firebase/database';
import { collection, addDoc, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { callAdminApi, hasEduLockAdminSession } from '@/lib/callAdminApi';
import { callPortalApi } from '@/lib/callPortalApi';

type FirestoreUnsubscribe = () => void;

const asObject = (value: unknown): Record<string, any> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, any>;
};

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const normalizeSchoolScope = (value?: string) => String(value || "").trim().toLowerCase();

export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  stock: number;
  available: number;
  coverUrl?: string;
}

export interface LiteracyTask {
  id: string;
  title: string;
  description: string;
  points: number;
  durationMinutes: number;
  isActive: boolean;
  createdAt: number;
  schoolId?: string;
  schoolName?: string;
}

export interface LiteracyReport {
  id: string;
  studentId: string;
  bookTitle: string;
  author: string;
  readingDuration: string; // e.g., "30 Menit", "1 Jam"
  summary: string;
  submissionDate: number; // Timestamp
  status: 'REVIEWED' | 'PENDING';
  grade?: string; // A, B, C, D
  feedback?: string;
  schoolId?: string;
  schoolName?: string;
}

export interface BorrowRecord {
  id: string;
  bookId: string;
  studentId: string;
  borrowDate: number; // Timestamp
  dueDate: number;    // Timestamp
  returnDate: number | null; // Timestamp
  status: 'BORROWED' | 'RETURNED' | 'OVERDUE';
  fines: number;
  schoolId?: string;
  schoolName?: string;
}

interface LibraryState {
  books: Book[];
  borrowRecords: BorrowRecord[];
  literacyReports: LiteracyReport[];
  literacyTasks: LiteracyTask[];
  booksUnsubscribe: FirestoreUnsubscribe | null;

  // Actions
  addBook: (book: Omit<Book, "id">) => Promise<void>;
  borrowBook: (studentId: string, bookId: string) => Promise<void>;
  returnBook: (recordId: string) => Promise<void>;
  getStudentActiveLoans: (studentId: string) => BorrowRecord[];
  addLiteracyReport: (report: Omit<LiteracyReport, "id" | "status" | "submissionDate">) => Promise<void>;
  reviewLiteracyReport: (id: string, grade: string, feedback: string) => Promise<void>;
  
  // Firebase Actions
  initBooksSync: () => () => void;
  initBorrowRecordSync: () => () => void;
  initLiteracyTaskSync: () => () => void;
  initLiteracyReportSync: () => () => void;
  createLiteracyTask: (task: Omit<LiteracyTask, "id">) => Promise<void>;
  toggleTaskStatus: (taskId: string, isActive: boolean) => Promise<void>;
  fetchPortalTasks: () => Promise<Array<Omit<LiteracyTask, "id" | "createdAt" | "isActive"> & { id: string }>>;
  deleteFromInbox: (inboxId: string) => Promise<void>;
}

// Initial Mock Data - Books
const initialBooks: Book[] = [
  { id: 'b1', title: 'Laskar Pelangi', author: 'Andrea Hirata', category: 'Fiksi', stock: 5, available: 4 },
  { id: 'b2', title: 'Bumi Manusia', author: 'Pramoedya Ananta Toer', category: 'Fiksi', stock: 3, available: 3 },
  { id: 'b3', title: 'Matematika Kelas 8', author: 'Kemendikbud', category: 'Pelajaran', stock: 20, available: 15 },
  { id: 'b4', title: 'Biologi Dasar', author: 'Campbell', category: 'Sains', stock: 10, available: 10 },
  { id: 'b5', title: 'Sejarah Indonesia Modern', author: 'M.C. Ricklefs', category: 'Sejarah', stock: 4, available: 4 },
  { id: 'b6', title: 'Harry Potter and the Sorcerers Stone', author: 'J.K. Rowling', category: 'Fiksi', stock: 7, available: 6 },
  { id: 'b7', title: 'Atomic Habits', author: 'James Clear', category: 'Self Improvement', stock: 5, available: 2 },
];

// Initial Mock Data - Borrow Records
const initialRecords: BorrowRecord[] = [
  {
    id: 'r1',
    bookId: 'b1',
    studentId: '4', // miko
    borrowDate: new Date('2026-01-20').getTime(),
    dueDate: new Date('2026-01-27').getTime(),
    returnDate: null,
    status: 'OVERDUE', // Late!
    fines: 500
  },
  {
    id: 'r2',
    bookId: 'b3',
    studentId: '2', // Siti Aminah
    borrowDate: new Date('2026-01-25').getTime(),
    dueDate: new Date('2026-02-01').getTime(),
    returnDate: null,
    status: 'BORROWED',
    fines: 0
  },
  {
    id: 'r3',
    bookId: 'b7',
    studentId: '1', // Ahmad Rizki
    borrowDate: new Date('2026-01-26').getTime(),
    dueDate: new Date('2026-02-02').getTime(),
    returnDate: null,
    status: 'BORROWED',
    fines: 0
  },
  {
    id: 'r4',
    bookId: 'b7',
    studentId: '4', // miko
    borrowDate: new Date('2026-01-26').getTime(),
    dueDate: new Date('2026-02-02').getTime(),
    returnDate: null,
    status: 'BORROWED',
    fines: 0
  },
  {
    id: 'r5',
    bookId: 'b6',
    studentId: '3', // Doni
    borrowDate: new Date('2026-01-28').getTime(),
    dueDate: new Date('2026-02-04').getTime(),
    returnDate: null,
    status: 'BORROWED',
    fines: 0
  }
];

// Initial Mock Data - Literacy Reports
const initialLiteracyReports: LiteracyReport[] = [
  {
    id: 'l1',
    studentId: '4', // miko
    bookTitle: 'Laskar Pelangi',
    author: 'Andrea Hirata',
    readingDuration: '30 Menit',
    summary: 'Buku ini menceritakan tentang perjuangan anak-anak Belitong dalam mengejar mimpi mereka bersekolah di SD Muhammadiyah Gantong. Sangat inspiratif karena mengajarkan kita untuk tidak menyerah pada keterbatasan.',
    submissionDate: new Date('2026-01-25').getTime(),
    status: 'REVIEWED',
    grade: 'A',
    feedback: 'Ringkasan yang bagus, Miko!'
  },
  {
    id: 'l2',
    studentId: '2', // Siti Aminah
    bookTitle: 'Biologi Dasar',
    author: 'Campbell',
    readingDuration: '1 Jam',
    summary: 'Mempelajari tentang struktur sel dan fungsinya. Mitokondria adalah the powerhouse of the cell.',
    submissionDate: new Date('2026-01-26').getTime(),
    status: 'PENDING'
  },
  {
    id: 'l3',
    studentId: '1', // Ahmad Rizki
    bookTitle: 'Atomic Habits',
    author: 'James Clear',
    readingDuration: '45 Menit',
    summary: 'Perubahan kecil yang dilakukan secara konsisten akan menghasilkan dampak yang luar biasa di masa depan.',
    submissionDate: new Date('2026-01-27').getTime(),
    status: 'PENDING'
  },
  {
    id: 'l4',
    studentId: '4', // miko (Simulasi Data Baru Masuk)
    bookTitle: 'Harry Potter',
    author: 'J.K. Rowling',
    readingDuration: '2 Jam',
    summary: 'Petualangan Harry di tahun pertama Hogwarts. Sangat seru dan penuh sihir!',
    submissionDate: new Date().getTime(), // Hari ini
    status: 'PENDING'
  }
];

export const useLibraryStore = create<LibraryState>((set, get) => ({
  books: [], // Will be populated by initBooksSync()
  borrowRecords: [],
  literacyReports: [],
  literacyTasks: [],
  booksUnsubscribe: null,

  initBooksSync: () => {
    const state = get();
    // Unsubscribe from previous listener if exists
    if (state.booksUnsubscribe) {
      state.booksUnsubscribe();
    }

    try {
      const booksRef = collection(db, 'books');
      const unsubscribe = onSnapshot(booksRef, (snapshot) => {
        const books: Book[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          books.push({
            id: doc.id,
            title: data.title || data.judul || 'Tanpa Judul',
            author: data.author || data.penulis || '-',
            category: data.category || data.kategori || data.mainCategory || 'Umum',
            stock: data.stock || 0,
            available: data.available !== undefined ? data.available : data.stock || 0,
            coverUrl: data.coverUrl,
          });
        });

        // Sort by title
        books.sort((a, b) => a.title.localeCompare(b.title));
        set({ books });
      }, (error) => {
        console.error('Error syncing books from Firestore:', error);
      });

      set({ booksUnsubscribe: unsubscribe });
      return unsubscribe;
    } catch (error) {
      console.error('Failed to initialize books sync:', error);
      return () => { };
    }
  },

  addBook: async (bookData) => {
    try {
      const booksRef = collection(db, 'books');
      const newBook = {
        ...bookData,
        available: bookData.stock, // Initialize available to stock
      };
      await addDoc(booksRef, newBook);
      // The onSnapshot listener will automatically update the local state
    } catch (error) {
      console.error('Error adding book to Firestore:', error);
      throw error;
    }
  },

  borrowBook: async (studentId, bookId) => {
    const book = get().books.find(b => b.id === bookId);
    if (!book || book.available <= 0) return;
    const authUser = useAuthStore.getState().user;

    try {
      if (hasEduLockAdminSession()) {
        await callAdminApi("/api/admin/library", "POST", {
          action: "borrow-book",
          schoolId: authUser?.schoolId || undefined,
          studentId,
          bookId,
        });
      } else {
        await callPortalApi("/api/portal/library", "POST", {
          action: "borrow-book",
          studentId,
          bookId,
        });
      }

    } catch (error) {
       console.error("Error borrowing book:", error);
       throw error;
    }
  },

  returnBook: async (recordId) => {
    const record = get().borrowRecords.find(r => r.id === recordId);
    if (!record || record.returnDate) return;
    
    try {
       if (hasEduLockAdminSession()) {
          await callAdminApi("/api/admin/library", "POST", {
            action: "return-book",
            recordId,
            schoolId: record.schoolId || undefined,
          });
       } else {
          await callPortalApi("/api/portal/library", "POST", {
            action: "return-book",
            recordId,
          });
       }
    } catch (error) {
       console.error("Error returning book:", error);
       throw error;
    }
  },

  getStudentActiveLoans: (studentId) => {
    return get().borrowRecords.filter(r => r.studentId === studentId && !r.returnDate);
  },

  addLiteracyReport: async (report) => {
    try {
      const authUser = useAuthStore.getState().user;
      if (hasEduLockAdminSession()) {
        await callAdminApi("/api/admin/library", "POST", {
          action: "submit-report",
          schoolId: authUser?.schoolId || undefined,
          report,
        });
      } else {
        await callPortalApi("/api/portal/library", "POST", {
          action: "submit-report",
          report,
        });
      }
    } catch (error) {
       console.error("Error adding literacy report:", error);
       throw error;
    }
  },

  reviewLiteracyReport: async (id, grade, feedback) => {
    try {
      if (hasEduLockAdminSession()) {
        await callAdminApi("/api/admin/library", "POST", {
          action: "review-report",
          reportId: id,
          grade,
          feedback,
        });
      } else {
        await callPortalApi("/api/portal/library", "POST", {
          action: "review-report",
          reportId: id,
          grade,
          feedback,
        });
      }
    } catch (error) {
      console.error("Error reviewing literacy report:", error);
      throw error;
    }
  },

  initLiteracyTaskSync: () => {
    const authUser = useAuthStore.getState().user;
    const scope = normalizeSchoolScope(authUser?.schoolId);
    const isSuperAdmin = authUser?.role === 'super_admin';
    if (!isSuperAdmin && !scope) {
      set({ literacyTasks: [] });
      return () => {};
    }

    const tasksRef =
      !isSuperAdmin && scope
        ? rtdbQuery(ref(database, 'literacy_tasks'), orderByChild('schoolId'), equalTo(scope))
        : ref(database, 'literacy_tasks');
    const unsubscribe = onValue(tasksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const tasks: LiteracyTask[] = Object.entries(data)
          .flatMap(([key, rawValue]) => {
            const item = asObject(rawValue);
            if (!item) return [];

            return [{
              ...item,
              id: key,
              title: String(item.title || item.judul || "Tanpa Judul").trim() || "Tanpa Judul",
              description: String(item.description || item.deskripsi || "").trim(),
              points: toNumber(item.points, 0),
              durationMinutes: toNumber(item.durationMinutes, 0),
              isActive: Boolean(item.isActive),
              createdAt: toNumber(item.createdAt, Date.now()),
              schoolId: item.schoolId ? String(item.schoolId) : undefined,
              schoolName: item.schoolName ? String(item.schoolName) : undefined,
            } satisfies LiteracyTask];
          })
          .filter((task) => {
            if (isSuperAdmin) return true;
            const itemScope = normalizeSchoolScope(task.schoolId);
            return itemScope === scope;
          });
        set({ literacyTasks: tasks.sort((a, b) => b.createdAt - a.createdAt) });
      } else {
        set({ literacyTasks: [] });
      }
    });
    return unsubscribe;
  },

  initBorrowRecordSync: () => {
    const authUser = useAuthStore.getState().user;
    const scope = normalizeSchoolScope(authUser?.schoolId);
    const isSuperAdmin = authUser?.role === 'super_admin';
    if (!isSuperAdmin && !scope) {
      set({ borrowRecords: [] });
      return () => {};
    }

    const recordsRef =
      !isSuperAdmin && scope
        ? rtdbQuery(ref(database, 'borrow_records'), orderByChild('schoolId'), equalTo(scope))
        : ref(database, 'borrow_records');
    const unsubscribe = onValue(recordsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const records: BorrowRecord[] = Object.entries(data)
          .flatMap(([key, rawValue]) => {
            const item = asObject(rawValue);
            if (!item) return [];

            const status =
              item.status === "RETURNED" || item.status === "OVERDUE" || item.status === "BORROWED"
                ? item.status
                : "BORROWED";

            return [{
              ...item,
              id: key,
              bookId: String(item.bookId || "").trim(),
              studentId: String(item.studentId || "").trim(),
              borrowDate: toNumber(item.borrowDate, Date.now()),
              dueDate: toNumber(item.dueDate, Date.now()),
              returnDate: item.returnDate == null ? null : toNumber(item.returnDate, null as any),
              status,
              fines: toNumber(item.fines, 0),
              schoolId: item.schoolId ? String(item.schoolId) : undefined,
              schoolName: item.schoolName ? String(item.schoolName) : undefined,
            } satisfies BorrowRecord];
          })
          .filter((record) => {
            if (isSuperAdmin) return true;
            const itemScope = normalizeSchoolScope(record.schoolId);
            return itemScope === scope;
          });
        set({ borrowRecords: records.sort((a, b) => b.borrowDate - a.borrowDate) });
      } else {
        set({ borrowRecords: [] });
      }
    });
    return unsubscribe;
  },

  initLiteracyReportSync: () => {
    const authUser = useAuthStore.getState().user;
    const scope = normalizeSchoolScope(authUser?.schoolId);
    const isSuperAdmin = authUser?.role === 'super_admin';
    if (!isSuperAdmin && !scope) {
      set({ literacyReports: [] });
      return () => {};
    }

    const reportsRef =
      !isSuperAdmin && scope
        ? rtdbQuery(ref(database, 'literacy_reports'), orderByChild('schoolId'), equalTo(scope))
        : ref(database, 'literacy_reports');
    const unsubscribe = onValue(reportsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const reports: LiteracyReport[] = Object.entries(data)
          .flatMap(([key, rawValue]) => {
            const item = asObject(rawValue);
            if (!item) return [];

            const status = item.status === "REVIEWED" ? "REVIEWED" : "PENDING";

            return [{
              ...item,
              id: key,
              studentId: String(item.studentId || "").trim(),
              bookTitle: String(item.bookTitle || item.title || "Tanpa Judul").trim() || "Tanpa Judul",
              author: String(item.author || "-").trim() || "-",
              readingDuration: String(item.readingDuration || item.duration || "-").trim() || "-",
              summary: String(item.summary || "").trim(),
              submissionDate: toNumber(item.submissionDate, Date.now()),
              status,
              grade: item.grade ? String(item.grade) : undefined,
              feedback: item.feedback ? String(item.feedback) : undefined,
              schoolId: item.schoolId ? String(item.schoolId) : undefined,
              schoolName: item.schoolName ? String(item.schoolName) : undefined,
            } satisfies LiteracyReport];
          })
          .filter((report) => {
            if (isSuperAdmin) return true;
            const itemScope = normalizeSchoolScope(report.schoolId);
            return itemScope === scope;
          });
        set({ literacyReports: reports.sort((a, b) => b.submissionDate - a.submissionDate) });
      } else {
        set({ literacyReports: [] });
      }
    });
    return unsubscribe;
  },

  createLiteracyTask: async (task) => {
    const authUser = useAuthStore.getState().user;
    if (hasEduLockAdminSession()) {
      await callAdminApi("/api/admin/library", "POST", {
        action: "create-task",
        schoolId: authUser?.schoolId || undefined,
        task,
      });
      return;
    }

    await callPortalApi("/api/portal/library", "POST", {
      action: "create-task",
      task,
    });
  },

  toggleTaskStatus: async (taskId, isActive) => {
    if (hasEduLockAdminSession()) {
      await callAdminApi("/api/admin/library", "POST", {
        action: "toggle-task-status",
        taskId,
        isActive,
      });
      return;
    }

    await callPortalApi("/api/portal/library", "POST", {
      action: "toggle-task-status",
      taskId,
      isActive,
    });
  },

  // Real Portal Integration (via Firebase Buffer)
  fetchPortalTasks: async () => {
    try {
      // 1. Try to fetch from Firebase "portal_inbox" (Simulated Portal)
      const inboxRef = ref(database, 'portal_inbox');
      const snapshot = await firebaseGet(inboxRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log("Raw Portal Data:", data); // Debug log
        return Object.keys(data).map(key => {
          const item = data[key];

          // Helper to parse date string to timestamp
          const parseDate = (dateStr: string | number) => {
            if (typeof dateStr === 'number') return dateStr;
            if (!dateStr) return Date.now();
            // Try parsing "YYYY-MM-DD" or similar
            const parsed = new Date(dateStr).getTime();
            return isNaN(parsed) ? Date.now() : parsed;
          };

          return {
            id: key,
            // Handle multiple potential key formats (English, Indonesian, camelCase, lowerCase, Custom Portal)
            title: item.title || item.judul || item.Judul || item["Judul Tugas"] || "Tanpa Judul",
            description: item.description || item.deskripsi || item.Deskripsi || item["Deskripsi & Instruksi"] || item.instruction || "Tidak ada deskripsi",
            points: Number(item.points || item.poin || item.Poin || item["Poin Reward"] || item.reward || 0),
            // Map "Tanggal Pelaksanaan" to createdAt
            createdAt: parseDate(item.createdAt || item.date || item.tanggal || item.Tanggal || item["Tanggal Pelaksanaan"] || item.executionDate),
            // Default duration if not provided (Default 1 Jam Pelajaran = 45 Menit)
            durationMinutes: Number(item.durationMinutes || item.durasi || 45)
          };
        });
      }
    } catch (error) {
      console.error("Failed to fetch from portal_inbox", error);
    }

    return [];
  },

  deleteFromInbox: async (inboxId) => {
    // Only delete if it's not a mock ID
    if (!inboxId.startsWith('portal-')) {
      const inboxRef = ref(database, `portal_inbox/${inboxId}`);
      await remove(inboxRef);
    }
  }
}));
