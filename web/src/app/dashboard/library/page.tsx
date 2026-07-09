"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Book, BookOpen, Clock, AlertCircle, ExternalLink, FileText, Printer, Download, Plus, Check, X, Calendar, Trash2, ArrowLeft, Star, MessageCircle, RefreshCw, BarChart3, Pencil } from "lucide-react";
import { useLibraryStore, LiteracyReport, LiteracyTask } from "@/store/useLibraryStore";
import { useStudentStore } from "@/store/useStudentStore";
import { useClassStore } from "@/store/useClassStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { database } from "@/lib/firebase";
import { exportToExcel } from "@/utils/export";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { toast } from "sonner";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { onValue, ref } from "firebase/database";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface EnrichedLiteracyReport extends LiteracyReport {
  studentName: string;
  studentClass: string;
}

type LibraryTab = 'loans' | 'literacy' | 'tasks' | 'stats' | 'catalog' | 'literacy_tasks' | 'my_books' | 'profile';
type AdminLiteracyTab = 'list' | 'progress';
type AdminTaskView = 'tasks' | 'needs-grading' | 'history';

type LibraryPageProps = {
  initialTab?: LibraryTab;
  initialAdminLiteracyTab?: AdminLiteracyTab;
  initialAdminTaskView?: AdminTaskView;
};

type LiteracyActivityLog = {
  id: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  schoolId?: string;
  taskId?: string;
  taskTitle?: string;
  bookTitle?: string;
  author?: string;
  summary?: string;
  status?: string;
  grade?: string;
  feedback?: string;
  timestamp: number;
};

const ADMIN_TASK_ROUTE_MAP: Record<AdminTaskView, string> = {
  tasks: "/dashboard/library/tasks",
  "needs-grading": "/dashboard/library/tasks/needs-grading",
  history: "/dashboard/library/tasks/history",
};

const LIBRARY_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const LITERACY_DISTRIBUTION_COLORS: Record<string, string> = {
  "Sangat Aktif": "#4ade80",
  "Aktif": "#22d3ee",
  "Cukup Aktif": "#facc15",
  "Perlu Dorongan": "#fb923c",
  "Belum Aktif": "#f87171",
};

function getDateKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSameMonthYear(timestamp: number | null | undefined, month: number, year: number) {
  if (!timestamp) return false;
  const date = new Date(timestamp);
  return date.getMonth() + 1 === month && date.getFullYear() === year;
}

function LibraryPageContent(props: LibraryPageProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dropdownClassName =
    "px-3 py-2 rounded-md border border-slate-500/70 bg-slate-950/90 text-sm font-medium text-slate-50 shadow-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-500/60";
  const dropdownStyle = { backgroundColor: "#020617", color: "#f8fafc", colorScheme: "dark" as const };
  const dropdownOptionStyle = { backgroundColor: "#020617", color: "#f8fafc" };
  const { user, _hasHydrated } = useAuthStore();
  const { taskDefaults, loading: settingsLoading } = useSettingsStore();
  const { books, borrowRecords, literacyReports, literacyTasks, reviewLiteracyReport, initBooksSync, initBorrowRecordSync, initLiteracyTaskSync, initLiteracyReportSync, createLiteracyTask, toggleTaskStatus, updateLiteracyTask, deleteLiteracyTask, addLiteracyReport, borrowBook } = useLibraryStore();
  const { students } = useStudentStore();
  const { classes } = useClassStore();
  
  const [isSyncing, setIsSyncing] = useState(true);
  const [activeTab, setActiveTab] = useState<LibraryTab>(props?.initialTab ?? 'catalog');
  
  // Literacy Tab State (APK Style)
  const [literacySubTab, setLiteracySubTab] = useState<'needs_grading' | 'graded'>('needs_grading');
  // Literacy Tab State (Admin)
  const [adminLiteracyTab, setAdminLiteracyTab] = useState<AdminLiteracyTab>(props?.initialAdminLiteracyTab ?? 'list');
  const [adminTaskView, setAdminTaskView] = useState<AdminTaskView>(props?.initialAdminTaskView ?? 'tasks');
  
  // Task Tab State (APK Style)
  const [taskSubTab, setTaskSubTab] = useState<'active' | 'draft'>('active');
  
  const [selectedReport, setSelectedReport] = useState<EnrichedLiteracyReport | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [statsMonth, setStatsMonth] = useState<number>(new Date().getMonth() + 1);
  const [statsYear, setStatsYear] = useState<number>(new Date().getFullYear());
  const [literacyActivityLogs, setLiteracyActivityLogs] = useState<LiteracyActivityLog[]>([]);
  
  // Grading Modal State
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [feedbackInput, setFeedbackInput] = useState("");
  const [gradeInput, setGradeInput] = useState("A");
  const [scoreInput, setScoreInput] = useState(100); // Numeric score

  // Task Management State
  const [showTaskModal, setShowTaskModal] = useState(false);
  
  // Submit Report Modal State (Student)
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [reportForm, setReportForm] = useState({
    bookTitle: "",
    author: "",
    summary: "",
    duration: "30 Menit"
  });

  // Book Detail Modal State
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState("");
  const [selectedCatalogCategory, setSelectedCatalogCategory] = useState("Semua");

  // Manual Task State
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPoints, setNewTaskPoints] = useState(30);
  const [newTaskDuration, setNewTaskDuration] = useState(45);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const isAdminPanel = user?.role === 'admin';
  const isAdminLentera = pathname === "/admin/lentera";

  const catalogCategories = useMemo(() => {
    const categories = Array.from(
      new Set(
        books
          .map((book) => String(book.category || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    return ["Semua", ...categories];
  }, [books]);

  const filteredCatalogBooks = useMemo(() => {
    const normalizedQuery = catalogSearchQuery.trim().toLowerCase();

    return books.filter((book) => {
      const category = String(book.category || "").trim();
      const matchesCategory =
        selectedCatalogCategory === "Semua" || category === selectedCatalogCategory;

      const matchesQuery =
        !normalizedQuery ||
        String(book.title || "").toLowerCase().includes(normalizedQuery) ||
        String(book.author || "").toLowerCase().includes(normalizedQuery) ||
        category.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [books, catalogSearchQuery, selectedCatalogCategory]);

  useEffect(() => {
    if (!props?.initialTab) return;
    setActiveTab(props.initialTab);
  }, [props?.initialTab]);

  useEffect(() => {
    if (!props?.initialAdminLiteracyTab) return;
    setAdminLiteracyTab(props.initialAdminLiteracyTab);
  }, [props?.initialAdminLiteracyTab]);

  useEffect(() => {
    if (!props?.initialAdminTaskView) return;
    setAdminTaskView(props.initialAdminTaskView);
  }, [props?.initialAdminTaskView]);

  useEffect(() => {
    const currentPath = String(pathname || "").trim();
    if (currentPath === ADMIN_TASK_ROUTE_MAP.tasks) {
      setActiveTab("tasks");
      setAdminTaskView("tasks");
      return;
    }
    if (currentPath === ADMIN_TASK_ROUTE_MAP["needs-grading"]) {
      setActiveTab("tasks");
      setAdminTaskView("needs-grading");
      return;
    }
    if (currentPath === ADMIN_TASK_ROUTE_MAP.history) {
      setActiveTab("tasks");
      setAdminTaskView("history");
    }
  }, [pathname]);

  useEffect(() => {
    const tab = String(searchParams.get("tab") || "").trim();
    if (tab === "loans" || tab === "literacy" || tab === "tasks" || tab === "stats") {
      setActiveTab(tab as LibraryTab);
    }

    const view = String(searchParams.get("view") || "").trim();
    if (view === "progress" || view === "list") {
      setAdminLiteracyTab(view as AdminLiteracyTab);
    }

    const taskView = String(searchParams.get("taskView") || "").trim();
    if (taskView === "tasks" || taskView === "needs-grading" || taskView === "history") {
      setAdminTaskView(taskView as AdminTaskView);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (user?.role === "super_admin") {
      router.replace("/dashboard/super");
    }
  }, [_hasHydrated, router, user?.role]);

  useEffect(() => {
    if (!selectedClassId) return;
    const exists = classes.some((c) => c.id === selectedClassId);
    if (!exists) {
      setSelectedClassId("");
    }
  }, [classes, selectedClassId]);

  useEffect(() => {
    setNewTaskPoints(taskDefaults.defaultPoints);
    setNewTaskDuration(taskDefaults.defaultDurationMinutes);
  }, [taskDefaults.defaultDurationMinutes, taskDefaults.defaultPoints]);

  const matchesStudentIdentity = (value: string | undefined | null, studentId: string | undefined, nisn: string | undefined) => {
    const source = String(value || "").trim();
    if (!source) return false;
    return source === String(studentId || "").trim() || source === String(nisn || "").trim();
  };

  const isCurrentUserRecord = (studentId: string | undefined | null) => {
    const currentId = String(user?.id || "").trim();
    const currentNisn = String(user?.nisn || "").trim();
    const source = String(studentId || "").trim();
    return Boolean(source) && (source === currentId || source === currentNisn);
  };

  const currentSchoolScope = String(user?.schoolId || "").trim().toLowerCase();
  const studentIdentitySet = useMemo(() => {
    const set = new Set<string>();
    students.forEach((student) => {
      if (student.id) set.add(String(student.id).trim());
      if (student.nisn) set.add(String(student.nisn).trim());
    });
    return set;
  }, [students]);

  const studentLookup = useMemo(() => {
    const map = new Map<string, typeof students[number]>();
    for (const student of students) {
      if (student.id) map.set(String(student.id).trim(), student);
      if (student.nisn) map.set(String(student.nisn).trim(), student);
    }
    return map;
  }, [students]);

  const isVisibleForCurrentSchool = (schoolId?: string | null, studentId?: string | null) => {
    if (user?.role === "super_admin" || !currentSchoolScope) return true;
    const itemScope = String(schoolId || "").trim().toLowerCase();
    if (itemScope) return itemScope === currentSchoolScope;
    return studentIdentitySet.has(String(studentId || "").trim());
  };

  useEffect(() => {
    const logsRef = ref(database, "literacy_logs");
    const unsubscribe = onValue(logsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data !== "object") {
        setLiteracyActivityLogs([]);
        return;
      }

      const nextLogs: LiteracyActivityLog[] = Object.entries(data)
        .flatMap(([key, rawValue]) => {
          const item = rawValue as Record<string, any> | null;
          if (!item || typeof item !== "object") return [];

          const studentId = String(item.studentId || item.nisn || item.studentNisn || "").trim();
          const timestamp = Number(item.timestamp || item.submissionDate || item.createdAt || 0) || Date.now();
          const schoolId = String(item.schoolId || "").trim();

          if (!isVisibleForCurrentSchool(schoolId, studentId)) return [];

          return [{
            id: key,
            studentId,
            studentName: String(item.studentName || item.name || "Tidak Dikenal").trim() || "Tidak Dikenal",
            studentClass: String(item.studentClass || item.class || item.kelas || "").trim(),
            schoolId: schoolId || undefined,
            taskId: item.taskId ? String(item.taskId).trim() : undefined,
            taskTitle: item.taskTitle ? String(item.taskTitle).trim() : undefined,
            bookTitle: item.bookTitle ? String(item.bookTitle).trim() : undefined,
            author: item.author ? String(item.author).trim() : undefined,
            summary: item.summary ? String(item.summary).trim() : undefined,
            status: item.status ? String(item.status).trim().toUpperCase() : undefined,
            grade: item.grade ? String(item.grade).trim() : undefined,
            feedback: item.feedback ? String(item.feedback).trim() : undefined,
            timestamp,
          } satisfies LiteracyActivityLog];
        })
        .sort((a, b) => b.timestamp - a.timestamp);

      setLiteracyActivityLogs(nextLogs);
    });

    return () => unsubscribe();
  }, [currentSchoolScope, studentIdentitySet, user?.role]);

  // Sync Data
  useEffect(() => {
    const unsubBooks = initBooksSync();
    const unsubBorrowRecords = initBorrowRecordSync();
    const unsubTasks = initLiteracyTaskSync();
    const unsubReports = initLiteracyReportSync();
    return () => {
      unsubBooks();
      unsubBorrowRecords();
      unsubTasks();
      unsubReports();
    };
  }, [initBooksSync, initBorrowRecordSync, initLiteracyTaskSync, initLiteracyReportSync]);
  useEffect(() => {
    if (props?.initialTab) return;
    if (user?.role === 'teacher') {
      setActiveTab('literacy');
    } else if (user?.role === 'student') {
      setActiveTab('catalog');
    } else {
      setActiveTab('tasks');
    }
  }, [props?.initialTab, user]);

  const resetTaskForm = () => {
    setEditingTaskId(null);
    setNewTaskTitle("");
    setNewTaskDesc("");
    setNewTaskPoints(taskDefaults.defaultPoints);
    setNewTaskDuration(taskDefaults.defaultDurationMinutes);
  };

  const handleCreateTask = async (asDraft: boolean = true) => {
    if (!newTaskTitle || !newTaskDesc) return;

    try {
      if (editingTaskId) {
        await updateLiteracyTask(editingTaskId, {
          title: newTaskTitle,
          description: newTaskDesc,
          points: newTaskPoints,
          durationMinutes: newTaskDuration,
        });
        toast.success("Tugas literasi berhasil diperbarui");
      } else {
        await createLiteracyTask({
          title: newTaskTitle,
          description: newTaskDesc,
          points: newTaskPoints,
          durationMinutes: newTaskDuration,
          isActive: !asDraft,
          createdAt: Date.now()
        });
        toast.success("Tugas literasi berhasil dibuat");
      }

      setShowTaskModal(false);
      resetTaskForm();
    } catch (error: any) {
      toast.error(error?.message || "Gagal menyimpan tugas literasi.");
    }
  };

  const openTaskModalForEdit = (task: LiteracyTask) => {
    setEditingTaskId(task.id);
    setNewTaskTitle(task.title);
    setNewTaskDesc(task.description);
    setNewTaskPoints(task.points);
    setNewTaskDuration(task.durationMinutes);
    setShowTaskModal(true);
  };

  const handleDeleteTask = async (task: LiteracyTask) => {
    const confirmed = window.confirm(`Hapus tugas "${task.title}"? Tindakan ini tidak dapat dibatalkan.`);
    if (!confirmed) return;

    try {
      await deleteLiteracyTask(task.id);
      toast.success("Tugas literasi berhasil dihapus");
    } catch (error: any) {
      toast.error(error?.message || "Gagal menghapus tugas literasi.");
    }
  };

  const openGradeModal = (report: EnrichedLiteracyReport) => {
    setSelectedReport(report);
    setFeedbackInput(report.feedback || "Ringkasan yang bagus!");
    setGradeInput(report.grade || "A");
    setScoreInput(100);
    setShowGradeModal(true);
  };

  const handleReviewSubmit = async () => {
    if (selectedReport) {
      try {
        await reviewLiteracyReport(selectedReport.id, gradeInput, feedbackInput);
        setShowGradeModal(false);
        setSelectedReport(null);
        setFeedbackInput("");
        setGradeInput("A");
        toast.success("Laporan berhasil dinilai");
      } catch (error: any) {
        toast.error(error?.message || "Gagal menilai laporan literasi.");
      }
    }
  };

  const handleExportLiteracy = () => {
    const exportData = enrichedReports.map(report => ({
      'Tanggal': new Date(report.submissionDate).toLocaleDateString('id-ID'),
      'Nama Siswa': report.studentName,
      'Kelas': report.studentClass,
      'Judul Buku': report.bookTitle,
      'Penulis': report.author,
      'Durasi Baca': report.readingDuration,
      'Ringkasan': report.summary,
      'Nilai': report.grade || '-',
      'Feedback': report.feedback || '-',
      'Status': report.status
    }));

    exportToExcel(exportData, `Laporan_Literasi_${selectedClassId ? classes.find(c => c.id === selectedClassId)?.name : 'Semua_Kelas'}`);
  };

  // Sync Data
  useEffect(() => {
    // Simulate initial loading for UI feedback
    const timer = setTimeout(() => {
      setIsSyncing(false);
    }, 1500);
    
    return () => {
      clearTimeout(timer);
    };
  }, []);

  // Stats Calculation
  const totalTitles = books.length;
  const visibleBorrowRecords = borrowRecords.filter((record) => isVisibleForCurrentSchool(record.schoolId, record.studentId));
  const visibleLiteracyReports = literacyReports.filter((report) => isVisibleForCurrentSchool(report.schoolId, report.studentId));
  const activeLoans = visibleBorrowRecords.filter(r => r.status === 'BORROWED' || r.status === 'OVERDUE').length;
  const overdueLoans = visibleBorrowRecords.filter(r => r.status === 'OVERDUE').length;
  const totalLiteracyReports = visibleLiteracyReports.length;
  const pendingLiteracyReports = visibleLiteracyReports.filter(r => r.status === 'PENDING').length;
  const publishedTasks = literacyTasks.filter(t => t.isActive).length;
  const draftTasks = literacyTasks.filter(t => !t.isActive).length;
  const adminTaskTitle =
    adminTaskView === 'tasks'
      ? 'Daftar Tugas'
      : adminTaskView === 'needs-grading'
        ? 'Perlu Dinilai'
        : 'Riwayat';
  const adminTaskDescription =
    adminTaskView === 'tasks'
      ? 'Buat, terbitkan, dan arsipkan tugas literasi untuk siswa sekolah Anda.'
      : adminTaskView === 'needs-grading'
        ? 'Daftar laporan literasi siswa yang masih menunggu penilaian.'
        : 'Riwayat laporan literasi yang sudah selesai dinilai.';
  const navigateToLibraryTab = (tab: 'loans' | 'literacy' | 'tasks' | 'stats') => {
    if (user?.role !== "admin" || isAdminLentera) {
      setActiveTab(tab);
      return;
    }

    if (tab === "tasks") {
      router.push(ADMIN_TASK_ROUTE_MAP[adminTaskView]);
      return;
    }

    const params = new URLSearchParams();
    params.set("tab", tab);
    if (tab === "literacy") {
      params.set("view", adminLiteracyTab);
    }
    router.push(`/dashboard/library?${params.toString()}`);
  };
  const navigateToAdminTaskView = (view: AdminTaskView) => {
    if (user?.role !== "admin" || isAdminLentera) {
      setAdminTaskView(view);
      setActiveTab("tasks");
      return;
    }

    router.push(ADMIN_TASK_ROUTE_MAP[view]);
  };

  // Enrich Records with Student & Book Data
  const enrichedRecords = visibleBorrowRecords
    .filter(record => {
      if (user?.role === 'student') {
        return isCurrentUserRecord(record.studentId);
      }
      return true;
    })
    .map(record => {
    const student = students.find(s => matchesStudentIdentity(record.studentId, s.id, s.nisn));
    const book = books.find(b => b.id === record.bookId);
    return {
      ...record,
      studentName: student?.name || "Siswa Tidak Dikenal",
      studentClass: student?.class || "-",
      bookTitle: book?.title || "Buku Tidak Dikenal",
      bookAuthor: book?.author || "-"
    };
  })
  .filter((record) => {
    if (user?.role === 'super_admin') return true;
    return record.studentName !== "Siswa Tidak Dikenal";
  })
  .sort((a, b) => b.borrowDate - a.borrowDate); // Newest first

  // Enrich Literacy Reports
  const enrichedReports = visibleLiteracyReports
    .filter(report => {
      if (user?.role === 'student') {
        return isCurrentUserRecord(report.studentId);
      }
      return true;
    })
    .map(report => {
    const student = students.find(s => matchesStudentIdentity(report.studentId, s.id, s.nisn));
    return {
      ...report,
      studentName: student?.name || "Siswa Tidak Dikenal",
      studentClass: student?.class || "-",
    };
  })
  .filter(report => {
    if (user?.role !== 'super_admin' && report.studentName === "Siswa Tidak Dikenal") return false;
    if (!selectedClassId) return true;
    const selectedClass = classes.find(c => c.id === selectedClassId);
    return selectedClass ? report.studentClass === selectedClass.name : true;
  })
  .sort((a, b) => b.submissionDate - a.submissionDate);

  const pendingReports = enrichedReports.filter((report) => report.status === 'PENDING');
  const reviewedReports = enrichedReports.filter((report) => report.status === 'REVIEWED');

  // Popular Books (Simulated by available stock vs total)
  const popularBooks = [...books].sort((a, b) => {
    const aBorrowed = a.stock - a.available;
    const bBorrowed = b.stock - b.available;
    return bBorrowed - aBorrowed;
  }).slice(0, 5);

  // Status Calculation
  const filteredStudents = selectedClassId 
    ? students.filter(s => s.class === classes.find(c => c.id === selectedClassId)?.name)
    : students;
  const selectedClassName = selectedClassId ? classes.find((c) => c.id === selectedClassId)?.name || "" : "";

  const unifiedLiteracyEntries = useMemo(() => {
    type UnifiedEntry = {
      id: string;
      studentId: string;
      studentName: string;
      studentClass: string;
      schoolId?: string;
      taskId?: string;
      taskTitle?: string;
      bookTitle?: string;
      summary?: string;
      status: string;
      grade?: string;
      timestamp: number;
      source: "report" | "log";
    };

    const entries: UnifiedEntry[] = [];

    for (const report of visibleLiteracyReports) {
      const student = studentLookup.get(String(report.studentId || "").trim());
      const studentName = student?.name || "Tidak Dikenal";
      const studentClass = student?.class || "-";
      if (user?.role !== "super_admin" && studentName === "Tidak Dikenal") continue;
      if (selectedClassName && studentClass !== selectedClassName) continue;

      entries.push({
        id: `report-${report.id}`,
        studentId: String(report.studentId || "").trim(),
        studentName,
        studentClass,
        schoolId: report.schoolId,
        taskId: undefined,
        taskTitle: undefined,
        bookTitle: report.bookTitle,
        summary: report.summary,
        status: String(report.status || "PENDING").toUpperCase(),
        grade: report.grade,
        timestamp: report.submissionDate,
        source: "report",
      });
    }

    for (const log of literacyActivityLogs) {
      const student = studentLookup.get(String(log.studentId || "").trim());
      const studentName = student?.name || log.studentName || "Tidak Dikenal";
      const studentClass = student?.class || log.studentClass || "-";
      if (user?.role !== "super_admin" && studentName === "Tidak Dikenal") continue;
      if (selectedClassName && studentClass !== selectedClassName) continue;

      entries.push({
        id: `log-${log.id}`,
        studentId: String(log.studentId || "").trim(),
        studentName,
        studentClass,
        schoolId: log.schoolId,
        taskId: log.taskId,
        taskTitle: log.taskTitle,
        bookTitle: log.bookTitle,
        summary: log.summary,
        status: String(log.status || "PENDING").toUpperCase(),
        grade: log.grade,
        timestamp: log.timestamp,
        source: "log",
      });
    }

    const deduped = new Map<string, UnifiedEntry>();
    for (const entry of entries) {
      const dedupeKey = [
        String(entry.studentId || "").trim(),
        getDateKey(entry.timestamp),
        String(entry.bookTitle || "").trim().toLowerCase(),
        String(entry.summary || "").trim().slice(0, 80).toLowerCase(),
      ].join("|");
      const existing = deduped.get(dedupeKey);
      if (!existing || entry.timestamp > existing.timestamp) {
        deduped.set(dedupeKey, entry);
      }
    }

    return Array.from(deduped.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [literacyActivityLogs, selectedClassName, studentLookup, user?.role, visibleLiteracyReports]);

  const statsStudents = filteredStudents;
  const selectedPeriodBorrowRecords = visibleBorrowRecords.filter((record) => {
    const student = studentLookup.get(String(record.studentId || "").trim());
    if (selectedClassName && student?.class !== selectedClassName) return false;
    return isSameMonthYear(record.borrowDate, statsMonth, statsYear);
  });
  const selectedPeriodActivityLogs = unifiedLiteracyEntries.filter((entry) => isSameMonthYear(entry.timestamp, statsMonth, statsYear));

  const literacyStudentStats = statsStudents
    .map((student) => {
      const studentBorrows = selectedPeriodBorrowRecords.filter((record) => matchesStudentIdentity(record.studentId, student.id, student.nisn));
      const studentEntries = selectedPeriodActivityLogs.filter((entry) => matchesStudentIdentity(entry.studentId, student.id, student.nisn));
      const taskEntries = studentEntries.filter((entry) => entry.taskId || entry.taskTitle);
      const activityDaySet = new Set<string>();

      studentBorrows.forEach((record) => {
        activityDaySet.add(getDateKey(record.borrowDate));
        if (isSameMonthYear(record.returnDate, statsMonth, statsYear)) {
          activityDaySet.add(getDateKey(Number(record.returnDate)));
        }
      });
      studentEntries.forEach((entry) => {
        activityDaySet.add(getDateKey(entry.timestamp));
      });

      const visitDays = activityDaySet.size;
      const borrowCount = studentBorrows.length;
      const reportCount = studentEntries.length;
      const taskSubmissionCount = taskEntries.length;
      const readingActivityCount = borrowCount + reportCount;

      const visitScore = Math.min((visitDays / 8) * 30, 30);
      const readingScore = Math.min((readingActivityCount / 4) * 35, 35);
      const taskScore = Math.min((taskSubmissionCount / 2) * 35, 35);
      const finalScore = Math.round(visitScore + readingScore + taskScore);

      const category = finalScore >= 85
        ? "Sangat Aktif"
        : finalScore >= 70
          ? "Aktif"
          : finalScore >= 50
            ? "Cukup Aktif"
            : finalScore > 0
              ? "Perlu Dorongan"
              : "Belum Aktif";

      return {
        studentId: String(student.id || student.nisn || "").trim(),
        studentName: student.name,
        studentNisn: student.nisn,
        studentClass: student.class || "-",
        visitDays,
        borrowCount,
        reportCount,
        taskSubmissionCount,
        finalScore,
        category,
      };
    })
    .sort((a, b) =>
      b.finalScore - a.finalScore ||
      b.reportCount - a.reportCount ||
      b.borrowCount - a.borrowCount ||
      a.studentName.localeCompare(b.studentName, "id-ID")
    );

  const activeLiteracyStudentIds = new Set(
    literacyStudentStats
      .filter((row) => row.finalScore > 0)
      .map((row) => row.studentId)
  );

  const completedStudents = statsStudents.filter((student) =>
    activeLiteracyStudentIds.has(String(student.id || student.nisn || "").trim())
  );

  const incompleteStudents = statsStudents.filter((student) =>
    !activeLiteracyStudentIds.has(String(student.id || student.nisn || "").trim())
  );

  const literacyRuleSummary = [
    "Kunjungan Literasi dihitung dari hari unik yang memiliki aktivitas Lentera terekam: peminjaman, pengembalian, atau kirim laporan/tugas.",
    "Aktivitas Buku dihitung dari jumlah peminjaman buku ditambah laporan/ringkasan bacaan yang terkirim pada periode terpilih.",
    "Aktivitas Tugas dihitung dari pengiriman laporan yang membawa taskId atau taskTitle, agar tugas literasi terpisah dari bacaan bebas.",
  ];

  const literacyScoreFormula = "Skor = min(Hari Aktif/8, 1) x 30 + min((Peminjaman + Laporan)/4, 1) x 35 + min(Tugas Dikerjakan/2, 1) x 35";
  const literacyMonitoringSourceSummary = [
    "Monitoring Lentera memakai data database inti sekolah: master_students untuk identitas siswa dan master_classes untuk struktur kelas.",
    "Aktivitas literasi hanya dihitung dari borrow_records, literacy_reports, dan literacy_logs yang lolos scope sekolah dan pencocokan NISN/ID siswa.",
    "Halaman Data Anggota tidak dipakai sebagai sumber hitung; halaman itu hanya tampilan daftar siswa dari database inti yang sama.",
  ];

  const classReportStats = (() => {
    const map = new Map<string, { className: string; students: number; activeStudents: number; borrowCount: number; reportCount: number; taskCount: number; avgScore: number }>();
    for (const row of literacyStudentStats) {
      const className = String(row.studentClass || "-").trim() || "-";
      const current = map.get(className) || {
        className,
        students: 0,
        activeStudents: 0,
        borrowCount: 0,
        reportCount: 0,
        taskCount: 0,
        avgScore: 0,
      };
      current.students += 1;
      if (row.finalScore > 0) current.activeStudents += 1;
      current.borrowCount += row.borrowCount;
      current.reportCount += row.reportCount;
      current.taskCount += row.taskSubmissionCount;
      current.avgScore += row.finalScore;
      map.set(className, current);
    }

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        avgScore: row.students > 0 ? Math.round(row.avgScore / row.students) : 0,
      }))
      .sort((a, b) => b.avgScore - a.avgScore || a.className.localeCompare(b.className, "id-ID", { numeric: true }));
  })();

  const literacyTotals = {
    activeStudents: literacyStudentStats.filter((row) => row.finalScore > 0).length,
    totalVisitDays: literacyStudentStats.reduce((sum, row) => sum + row.visitDays, 0),
    totalBorrows: literacyStudentStats.reduce((sum, row) => sum + row.borrowCount, 0),
    totalReports: literacyStudentStats.reduce((sum, row) => sum + row.reportCount, 0),
    totalTasksDone: literacyStudentStats.reduce((sum, row) => sum + row.taskSubmissionCount, 0),
    averageScore: literacyStudentStats.length > 0
      ? Math.round(literacyStudentStats.reduce((sum, row) => sum + row.finalScore, 0) / literacyStudentStats.length)
      : 0,
  };

  const literacyDistributionData = [
    {
      name: "Sangat Aktif",
      value: literacyStudentStats.filter((row) => row.category === "Sangat Aktif").length,
      color: LITERACY_DISTRIBUTION_COLORS["Sangat Aktif"],
    },
    {
      name: "Aktif",
      value: literacyStudentStats.filter((row) => row.category === "Aktif").length,
      color: LITERACY_DISTRIBUTION_COLORS["Aktif"],
    },
    {
      name: "Cukup Aktif",
      value: literacyStudentStats.filter((row) => row.category === "Cukup Aktif").length,
      color: LITERACY_DISTRIBUTION_COLORS["Cukup Aktif"],
    },
    {
      name: "Perlu Dorongan",
      value: literacyStudentStats.filter((row) => row.category === "Perlu Dorongan").length,
      color: LITERACY_DISTRIBUTION_COLORS["Perlu Dorongan"],
    },
    {
      name: "Belum Aktif",
      value: literacyStudentStats.filter((row) => row.category === "Belum Aktif").length,
      color: LITERACY_DISTRIBUTION_COLORS["Belum Aktif"],
    },
  ];

  const topLiteracyStudents = literacyStudentStats.slice(0, 10);

  // STUDENT VIEW
  if (user?.role === 'student') {
    // Determine which sub-view to show based on activeTab
    // Default is 'catalog' (Katalog Buku)
    
    return (
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="bg-slate-900/70 backdrop-blur-xl border-b border-slate-700 px-4 py-3 shadow-sm">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <button onClick={() => router.back()} className="p-1 rounded-full hover:bg-slate-800">
                    <ArrowLeft className="w-6 h-6 text-slate-300" />
                 </button>
                 <span className="font-bold text-lg text-slate-100">Lentera Digital</span>
              </div>
              <button onClick={() => {
                 initLiteracyTaskSync();
                 initLiteracyReportSync();
                 toast.success("Data diperbarui");
              }} className="p-2 rounded-full hover:bg-slate-800">
                 <RefreshCw className="w-5 h-5 text-slate-400" /> 
              </button>
           </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto pb-20">
            {activeTab === 'catalog' && (
                <div className="p-4 space-y-6">
                    {/* Greeting Banner */}
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                            <BookOpen className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm flex items-center gap-1">
                               <span className="inline-block animate-spin duration-1000">
                                  <Clock className="w-3 h-3" />
                               </span>
                               Selamat Datang,
                            </p>
                            <h2 className="font-bold text-slate-100 text-lg">{user.name}</h2>
                        </div>
                    </div>

                    {/* Section Title */}
                    <div className="flex items-center gap-2 text-red-400 font-bold text-lg">
                        <div className="w-1 h-6 bg-red-500 rounded-full"></div>
                        <FileText className="w-5 h-5" />
                        <h3>Katalog Buku</h3>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {catalogCategories.map((category) => {
                          const isActive = selectedCatalogCategory === category;
                          return (
                            <button
                              key={category}
                              type="button"
                              onClick={() => setSelectedCatalogCategory(category)}
                              className={`px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap shadow-sm transition-colors ${
                                isActive
                                  ? "bg-blue-600 text-white"
                                  : "glass-effect-dark-card border border-slate-700 text-slate-400 hover:bg-slate-900/30"
                              }`}
                            >
                              {category}
                            </button>
                          );
                        })}
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <input 
                           type="text" 
                           placeholder="Cari judul buku..." 
                           value={catalogSearchQuery}
                           onChange={(e) => setCatalogSearchQuery(e.target.value)}
                           className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-700 glass-effect-dark-card shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-400 outline-none transition-all text-slate-100 placeholder-slate-500"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 70 11-14 0 7 70 0114 0z" />
                              </svg>
                        </div>
                    </div>

                    {/* Book Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredCatalogBooks.length > 0 ? filteredCatalogBooks.map(book => (
                             <div key={book.id} onClick={() => setSelectedBook(book)} className="glass-effect-dark-card rounded-xl shadow-sm border border-slate-700 overflow-hidden hover:shadow-md transition-all group cursor-pointer">
                                <div className="aspect-[3/4] bg-slate-800/50 relative overflow-hidden">
                                     <div className="absolute top-2 right-2 bg-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm z-10">
                                         E-Book
                                     </div>
                                     {/* Placeholder Cover since we don't have real images yet */}
                                     <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900/30 to-indigo-900/30 text-slate-400 group-hover:scale-105 transition-transform duration-300">
                                         <Book className="w-12 h-12" />
                                     </div>
                                </div>
                                <div className="p-3">
                                    <h4 className="font-bold text-slate-100 text-sm line-clamp-2 leading-tight mb-1">{book.title}</h4>
                                    <p className="text-xs text-slate-400 mb-2">{book.author}</p>
                                    <span className="inline-block px-2 py-0.5 bg-red-900/30 text-red-400 text-[10px] font-bold uppercase rounded border border-red-700/50">
                                        {book.category || 'UMUM'}
                                    </span>
                                </div>
                             </div>
                        )) : (
                             <div className="col-span-full rounded-2xl border border-slate-700 glass-effect-dark-card px-6 py-10 text-center">
                                <Book className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                                <p className="text-sm font-semibold text-slate-200">
                                  {books.length === 0 ? "Belum ada buku tersedia." : "Tidak ada buku yang cocok dengan filter saat ini."}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {books.length === 0
                                    ? "Tambahkan koleksi buku terlebih dahulu agar katalog bisa digunakan."
                                    : "Coba ganti kategori atau kata kunci pencarian."}
                                </p>
                             </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* Other Tabs Content Placeholder */}
            {activeTab === 'literacy_tasks' && (
                <div className="p-4 space-y-4">
                    <div className="flex items-center gap-2 text-blue-400 font-bold text-lg mb-4">
                        <FileText className="w-5 h-5" />
                        <h3>Tugas Literasi</h3>
                    </div>

                    {literacyTasks.length > 0 ? (
                        <div className="space-y-3">
                            {literacyTasks.filter(t => t.isActive).map(task => {
                                const isCompleted = literacyReports.some(r => r.studentId === user.id && r.bookTitle === task.title); // Simplistic check
                                return (
                                <div key={task.id} className="glass-effect-dark-card p-4 rounded-xl shadow-sm border border-slate-700">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-slate-100">{task.title}</h4>
                                            <p className="text-sm text-slate-400 mt-1 line-clamp-2">{task.description}</p>
                                            <div className="flex items-center gap-3 mt-3">
                                                <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-1 rounded font-medium border border-blue-700/50">
                                                    {task.points} Poin
                                                </span>
                                                <span className="text-xs bg-slate-800/50 text-slate-400 px-2 py-1 rounded flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {task.durationMinutes} Menit
                                                </span>
                                            </div>
                                        </div>
                                        {isCompleted ? (
                                            <div className="bg-green-900/30 p-2 rounded-full border border-green-700/50">
                                                <Check className="w-5 h-5 text-green-400" />
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => {
                                                    setReportForm(prev => ({ ...prev, bookTitle: task.title }));
                                                    setShowSubmitModal(true);
                                                }}
                                                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-blue-700"
                                            >
                                                Kerjakan
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )})}
                        </div>
                    ) : (
                         <div className="flex flex-col items-center justify-center h-64 text-center">
                            <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-3">
                                <FileText className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-slate-400 font-medium">Belum ada tugas literasi aktif</p>
                        </div>
                    )}
                </div>
            )}

             {activeTab === 'my_books' && (
                <div className="p-4 space-y-4">
                    <div className="flex items-center gap-2 text-purple-400 font-bold text-lg mb-4">
                        <BookOpen className="w-5 h-5" />
                        <h3>Buku Saya</h3>
                    </div>

                    {enrichedRecords.length > 0 ? (
                        <div className="space-y-3">
                            {enrichedRecords.map(record => (
                                <div key={record.id} className="glass-effect-dark-card p-4 rounded-xl shadow-sm border border-slate-700 flex gap-4">
                                    <div className="w-16 h-20 bg-slate-700/50 rounded-md flex items-center justify-center shrink-0">
                                        <Book className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-100 line-clamp-1">{record.bookTitle}</h4>
                                        <p className="text-xs text-slate-400 mb-2">{record.bookAuthor}</p>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                                                record.status === 'BORROWED' ? 'bg-blue-900/30 text-blue-400 border-blue-700/50' :
                                                record.status === 'OVERDUE' ? 'bg-red-900/30 text-red-400 border-red-700/50' :
                                                'bg-green-900/30 text-green-400 border-green-700/50'
                                            }`}>
                                                {record.status === 'BORROWED' ? 'DIPINJAM' : 
                                                 record.status === 'OVERDUE' ? 'TERLAMBAT' : 'DIKEMBALIKAN'}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                {new Date(record.borrowDate).toLocaleDateString('id-ID')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-3">
                                <BookOpen className="w-8 h-8 text-slate-400" />
                            </div>
                            <p className="text-slate-400 font-medium">Anda belum meminjam buku apapun</p>
                            <button onClick={() => setActiveTab('catalog')} className="mt-3 text-blue-400 text-sm font-bold">
                                Cari Buku di Katalog
                            </button>
                        </div>
                    )}
                </div>
            )}
             {activeTab === 'profile' && (
                <div className="p-4 space-y-6">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 glass-effect-dark-card/20 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-white/30">
                                <span className="text-2xl font-bold">{user.name.charAt(0)}</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">{user.name}</h2>
                                <p className="text-blue-100 text-sm">{user.role === 'student' ? `Siswa Kelas ${user.class}` : 'Guru'}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-6">
                            <div className="glass-effect-dark-card/10 rounded-xl p-3 text-center backdrop-blur-sm">
                                <span className="block text-2xl font-bold">{enrichedRecords.length}</span>
                                <span className="text-[10px] uppercase tracking-wider opacity-80">Buku</span>
                            </div>
                            <div className="glass-effect-dark-card/10 rounded-xl p-3 text-center backdrop-blur-sm">
                                <span className="block text-2xl font-bold">{literacyReports.length}</span>
                                <span className="text-[10px] uppercase tracking-wider opacity-80">Laporan</span>
                            </div>
                             <div className="glass-effect-dark-card/10 rounded-xl p-3 text-center backdrop-blur-sm">
                                <span className="block text-2xl font-bold">0</span>
                                <span className="text-[10px] uppercase tracking-wider opacity-80">Poin</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="glass-effect-dark-card rounded-xl shadow-sm border border-slate-700 p-4">
                        <h3 className="font-bold text-slate-100 mb-4">Statistik Membaca</h3>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-400">Target Mingguan</span>
                                    <span className="font-bold text-slate-100">2/5 Buku</span>
                                </div>
                                <div className="w-full bg-slate-800/50 rounded-full h-2">
                                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: '40%' }}></div>
                                </div>
                            </div>
                             <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-400">Keaktifan Literasi</span>
                                    <span className="font-bold text-slate-100">High</span>
                                </div>
                                <div className="w-full bg-slate-800/50 rounded-full h-2">
                                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Submit Report Modal */}
        {showSubmitModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="glass-effect-dark-card rounded-2xl w-full max-w-md overflow-hidden shadow-xl animate-in fade-in zoom-in duration-200">
                    <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/30">
                        <h3 className="font-bold text-slate-100">Kirim Laporan Literasi</h3>
                        <button onClick={() => setShowSubmitModal(false)} className="p-1 rounded-full hover:bg-gray-200 transition-colors">
                            <X className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>
                    
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Judul Buku</label>
                            <input 
                                type="text" 
                                value={reportForm.bookTitle}
                                onChange={(e) => setReportForm({...reportForm, bookTitle: e.target.value})}
                                className="w-full px-4 py-2 rounded-xl border border-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all"
                                placeholder="Contoh: Laskar Pelangi"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Penulis</label>
                            <input 
                                type="text" 
                                value={reportForm.author}
                                onChange={(e) => setReportForm({...reportForm, author: e.target.value})}
                                className="w-full px-4 py-2 rounded-xl border border-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all"
                                placeholder="Nama penulis buku"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Durasi Baca</label>
                            <select 
                                value={reportForm.duration}
                                onChange={(e) => setReportForm({...reportForm, duration: e.target.value})}
                                className="w-full px-4 py-2 rounded-xl border border-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all glass-effect-dark-card"
                            >
                                <option value="15 Menit">15 Menit</option>
                                <option value="30 Menit">30 Menit</option>
                                <option value="45 Menit">45 Menit</option>
                                <option value="1 Jam">1 Jam</option>
                                <option value="> 1 Jam">&gt; 1 Jam</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Ringkasan</label>
                            <textarea 
                                value={reportForm.summary}
                                onChange={(e) => setReportForm({...reportForm, summary: e.target.value})}
                                className="w-full px-4 py-2 rounded-xl border border-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all h-32 resize-none"
                                placeholder="Tuliskan ringkasan singkat dari apa yang kamu baca..."
                            />
                        </div>
                    </div>

                    <div className="px-6 py-4 bg-slate-900/30 border-t border-slate-700 flex justify-end gap-3">
                        <button 
                            onClick={() => setShowSubmitModal(false)}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-gray-200 transition-colors"
                        >
                            Batal
                        </button>
                        <button 
                            onClick={async () => {
                                if(!reportForm.bookTitle || !reportForm.summary) {
                                    toast.error("Mohon lengkapi data laporan");
                                    return;
                                }
                                try {
                                  await addLiteracyReport({
                                      studentId: user.id,
                                      bookTitle: reportForm.bookTitle,
                                      author: reportForm.author || "-",
                                      readingDuration: reportForm.duration,
                                      summary: reportForm.summary
                                  });
                                  setShowSubmitModal(false);
                                  setReportForm({bookTitle: "", author: "", summary: "", duration: "30 Menit"});
                                  toast.success("Laporan literasi berhasil dikirim!");
                                } catch (error: any) {
                                  toast.error(error?.message || "Gagal mengirim laporan literasi.");
                                }
                            }}
                            className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors"
                        >
                            Kirim Laporan
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Book Detail Modal */}
        {selectedBook && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="glass-effect-dark-card rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in fade-in zoom-in duration-200">
                     <div className="relative aspect-[2/3] bg-slate-800/50">
                        {/* Close Button */}
                        <button 
                            onClick={() => setSelectedBook(null)}
                            className="absolute top-4 right-4 z-10 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
                        {/* Book Cover Placeholder */}
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
                            <Book className="w-24 h-24 text-gray-300" />
                        </div>
                        
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-20">
                            <span className="inline-block px-2 py-0.5 bg-pink-500 text-white text-[10px] font-bold rounded mb-2">
                                {selectedBook.category || 'UMUM'}
                            </span>
                            <h3 className="text-xl font-bold text-white leading-tight mb-1">{selectedBook.title}</h3>
                            <p className="text-gray-300 text-sm">{selectedBook.author}</p>
                        </div>
                    </div>
                    
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <div className="text-center">
                                <span className="block text-xl font-bold text-slate-100">{selectedBook.stock}</span>
                                <span className="text-[10px] text-slate-400 uppercase font-bold">Total</span>
                            </div>
                            <div className="w-px h-8 bg-slate-800/50"></div>
                            <div className="text-center">
                                <span className="block text-xl font-bold text-blue-600">{selectedBook.available}</span>
                                <span className="text-[10px] text-slate-400 uppercase font-bold">Tersedia</span>
                            </div>
                            <div className="w-px h-8 bg-slate-800/50"></div>
                            <div className="text-center">
                                <span className="block text-xl font-bold text-yellow-500">4.8</span>
                                <span className="text-[10px] text-slate-400 uppercase font-bold">Rating</span>
                            </div>
                        </div>

                        <button 
                            onClick={async () => {
                                if (selectedBook.available > 0) {
                                    try {
                                      await borrowBook(user.id, selectedBook.id);
                                      toast.success(`Berhasil meminjam buku "${selectedBook.title}"`);
                                      setSelectedBook(null);
                                    } catch (error: any) {
                                      toast.error(error?.message || "Gagal meminjam buku.");
                                    }
                                } else {
                                    toast.error("Stok buku habis!");
                                }
                            }}
                            disabled={selectedBook.available <= 0}
                            className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 ${
                                selectedBook.available > 0 
                                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' 
                                : 'bg-gray-300 cursor-not-allowed'
                            }`}
                        >
                            {selectedBook.available > 0 ? 'Pinjam Buku Ini' : 'Stok Habis'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Bottom Navigation (Sticky) */}
        <div className="glass-effect-dark-card border-t border-slate-700 px-6 py-2 sticky bottom-0 z-20">
            <div className="flex justify-between items-center max-w-lg mx-auto">
                <button 
                   onClick={() => router.push('/dashboard')}
                   className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-slate-400 transition-colors"
                >
                    <div className="w-6 h-6 rounded-md border-2 border-current flex items-center justify-center">
                        <div className="w-3 h-3 bg-current rounded-sm"></div>
                    </div>
                    <span className="text-[10px] font-medium">Beranda</span>
                </button>
                
                <button 
                   onClick={() => setActiveTab('catalog')}
                   className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'catalog' ? 'text-pink-500' : 'text-gray-400 hover:text-slate-400'}`}
                >
                    <div className={`w-6 h-6 flex items-center justify-center ${activeTab === 'catalog' ? 'bg-pink-100 rounded-full' : ''}`}>
                       <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-medium">Katalog</span>
                </button>

                <button 
                   onClick={() => setActiveTab('literacy_tasks')}
                   className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'literacy_tasks' ? 'text-pink-500' : 'text-gray-400 hover:text-slate-400'}`}
                >
                    <div className={`w-6 h-6 flex items-center justify-center ${activeTab === 'literacy_tasks' ? 'bg-pink-100 rounded-full' : ''}`}>
                         <FileText className="w-4 h-4 transform rotate-12" />
                    </div>
                    <span className="text-[10px] font-medium">Tugas Literasi</span>
                </button>

                <button 
                   onClick={() => setActiveTab('my_books')}
                   className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'my_books' ? 'text-pink-500' : 'text-gray-400 hover:text-slate-400'}`}
                >
                     <div className={`w-6 h-6 flex items-center justify-center ${activeTab === 'my_books' ? 'bg-pink-100 rounded-full' : ''}`}>
                       <Star className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-medium">Buku Saya</span>
                </button>

                 <button 
                   onClick={() => setActiveTab('profile')}
                   className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'profile' ? 'text-pink-500' : 'text-gray-400 hover:text-slate-400'}`}
                >
                     <div className={`w-6 h-6 flex items-center justify-center ${activeTab === 'profile' ? 'bg-pink-100 rounded-full' : ''}`}>
                       <div className="w-4 h-4 rounded-full border-2 border-current"></div>
                    </div>
                    <span className="text-[10px] font-medium">Profil</span>
                </button>
            </div>
        </div>
      </div>
    );
  }




  const libraryContent = (
    <div className="space-y-6">
      {_hasHydrated && user?.role === "super_admin" ? (
        <div className="min-h-screen bg-slate-950" />
      ) : (
        <>
      {/* Print Header */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-2xl font-bold text-black uppercase">SMPN 3 Pacet</h1>
        <h2 className="text-xl font-bold text-black uppercase">Laporan Literasi Siswa</h2>
        {selectedClassId && (
          <h3 className="text-lg font-bold text-black uppercase mt-1">
            Kelas {classes.find(c => c.id === selectedClassId)?.name}
          </h3>
        )}
        <p className="text-sm text-black mt-2">
          Dicetak pada: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <div className="border-b-2 border-black mt-4"></div>
      </div>

      {/* Header */}
      {user?.role !== 'teacher' && (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            {isAdminPanel ? 'Panel Lentera Digital' : 'Monitoring E-Library & Literasi'}
            {isSyncing ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 animate-pulse">
                Menghubungkan...
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Terhubung: Lentera Digital
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {isAdminPanel
              ? `Kelola tugas, laporan literasi, dan aktivitas perpustakaan digital${user?.schoolName ? ` untuk ${user.schoolName}` : ''}.`
              : 'Integrasi data peminjaman buku dan laporan literasi siswa dari platform Perpustakaan Digital'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {isAdminPanel ? (
            <>
              <button
                onClick={() => router.push('/admin')}
                className="inline-flex items-center gap-2 rounded-md border border-slate-600 bg-slate-900/40 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900/60 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Dashboard Satu Pintu
              </button>
            </>
          ) : (
            <a
              href="/admin/lentera"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 glass-effect-dark-card border border-gray-300 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-900/30 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Buka Portal Lentera Digital
            </a>
          )}
        </div>
      </div>
      )}

      {isAdminPanel && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 print:hidden">
          <div className="glass-effect-dark-card rounded-xl border border-slate-700 p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-400">Tugas Aktif</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-100">{publishedTasks}</h3>
            <p className="mt-1 text-xs text-slate-400">Tugas yang sudah diterbitkan ke siswa</p>
          </div>
          <div className="glass-effect-dark-card rounded-xl border border-slate-700 p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-400">Laporan Menunggu</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-100">{pendingLiteracyReports}</h3>
            <p className="mt-1 text-xs text-slate-400">Ringkasan siswa yang masih perlu ditinjau</p>
          </div>
          <div className="glass-effect-dark-card rounded-xl border border-slate-700 p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-400">Draft Tersimpan</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-100">{draftTasks}</h3>
            <p className="mt-1 text-xs text-slate-400">Tugas yang belum diterbitkan ke sekolah Anda</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      {user?.role !== 'teacher' && !isAdminLentera && (
      <div className="border-b border-slate-700 print:hidden">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => navigateToLibraryTab('loans')}
            className={`
              flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors
              ${activeTab === 'loans'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-400 hover:border-gray-300 hover:text-slate-300'
              }
            `}
          >
            <BookOpen className="h-4 w-4" />
            Peminjaman Buku
          </button>
          <button
            onClick={() => navigateToLibraryTab('literacy')}
            className={`
              flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors
              ${activeTab === 'literacy'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-400 hover:border-gray-300 hover:text-slate-300'
              }
            `}
          >
            <FileText className="h-4 w-4" />
            Laporan Literasi
            <span className="ml-2 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
              {totalLiteracyReports}
            </span>
          </button>
          <button
            onClick={() => navigateToLibraryTab('tasks')}
            className={`
              flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors
              ${activeTab === 'tasks'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-400 hover:border-gray-300 hover:text-slate-300'
              }
            `}
          >
            <Book className="h-4 w-4" />
            Tugas Literasi
          </button>
          {isAdminPanel && (
            <button
              onClick={() => navigateToLibraryTab('stats')}
              className={`
                flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors
                ${activeTab === 'stats'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-400 hover:border-gray-300 hover:text-slate-300'
                }
              `}
            >
              <BarChart3 className="h-4 w-4" />
              Statistik
            </button>
          )}
        </nav>
      </div>
      )}
      
      {/* Filter & Print Toolbar for Literacy Tab - REMOVED to match APK Style (Merged into Header if needed) */}


      {activeTab === 'loans' ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
            <div className="glass-effect-dark-card rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Koleksi Judul</p>
                  <h3 className="text-2xl font-bold text-slate-100">{totalTitles}</h3>
                  <p className="text-xs text-gray-400 mt-1">Total judul buku terdaftar</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-full">
                  <Book className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </div>

            <div className="glass-effect-dark-card rounded-xl shadow-sm p-6 border-l-4 border-indigo-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Sedang Dipinjam</p>
                  <h3 className="text-2xl font-bold text-slate-100">{activeLoans}</h3>
                  <p className="text-xs text-gray-400 mt-1">Siswa sedang meminjam buku</p>
                </div>
                <div className="p-3 bg-indigo-50 rounded-full">
                  <BookOpen className="w-6 h-6 text-indigo-500" />
                </div>
              </div>
            </div>

            <div className="glass-effect-dark-card rounded-xl shadow-sm p-6 border-l-4 border-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Terlambat Pengembalian</p>
                  <h3 className="text-2xl font-bold text-red-600">{overdueLoans}</h3>
                  <p className="text-xs text-gray-400 mt-1">Perlu tindak lanjut</p>
                </div>
                <div className="p-3 bg-red-50 rounded-full">
                  <Clock className="w-6 h-6 text-red-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
            {/* Recent Activity Table */}
            <div className="lg:col-span-2 glass-effect-dark-card rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">Aktivitas Peminjaman Terkini</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-slate-900/30">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Siswa</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Buku</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Tgl Pinjam</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="glass-effect-dark-card divide-y divide-gray-200">
                    {enrichedRecords.slice(0, 10).map((record) => (
                      <tr key={record.id} className="hover:bg-slate-900/30">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-100">{record.studentName}</div>
                          <div className="text-xs text-slate-400">{record.studentClass}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-100 line-clamp-1">{record.bookTitle}</div>
                          <div className="text-xs text-slate-400">{record.bookAuthor}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                          {new Date(record.borrowDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            record.status === 'OVERDUE' 
                              ? 'bg-red-100 text-red-800' 
                              : record.status === 'RETURNED'
                                ? 'bg-slate-800/50 text-gray-800'
                                : 'bg-green-100 text-green-800'
                          }`}>
                            {record.status === 'OVERDUE' ? 'Terlambat' : record.status === 'RETURNED' ? 'Kembali' : 'Dipinjam'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Popular Books */}
            <div className="glass-effect-dark-card rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Buku Populer</h3>
              <div className="space-y-4">
                {popularBooks.map((book, index) => (
                  <div key={book.id} className="flex items-start gap-3 pb-3 border-b border-slate-700 last:border-0">
                    <div className="flex-shrink-0 w-8 h-10 bg-gray-200 rounded flex items-center justify-center text-xs font-bold text-slate-400">
                      #{index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">{book.title}</p>
                      <p className="text-xs text-slate-400 truncate">{book.author}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <span className="text-blue-600 font-medium">{book.stock - book.available} dipinjam</span>
                        <span className="text-gray-300">|</span>
                        <span className="text-slate-400">Stok: {book.stock}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 pt-4 border-t border-slate-700">
                 <div className="bg-yellow-50 rounded-md p-3">
                   <div className="flex">
                     <div className="flex-shrink-0">
                       <AlertCircle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                     </div>
                     <div className="ml-3">
                       <h3 className="text-sm font-medium text-yellow-800">Perhatian</h3>
                       <div className="mt-2 text-sm text-yellow-700">
                         <p>
                           Data diperbarui secara otomatis dari sistem Lentera Digital setiap 15 menit.
                         </p>
                       </div>
                     </div>
                   </div>
                 </div>
              </div>
            </div>
          </div>
        </>
      ) : activeTab === 'literacy' ? (
        user?.role === 'teacher' ? (
          <div className="min-h-screen bg-slate-900/30 -mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
            <div className="bg-blue-600 px-4 pt-6 pb-0 shadow-md">
              <div className="flex items-center text-white mb-4">
                <button onClick={() => router.back()} className="mr-4">
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                  <h1 className="text-xl font-bold">Literasi Siswa</h1>
                </div>
              </div>
              <div className="flex text-center">
                <button
                  onClick={() => setLiteracySubTab('needs_grading')}
                  className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
                    literacySubTab === 'needs_grading'
                      ? 'border-white text-white'
                      : 'border-transparent text-blue-200 hover:text-white'
                  }`}
                >
                  Perlu Dinilai
                </button>
                <button
                  onClick={() => setLiteracySubTab('graded')}
                  className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
                    literacySubTab === 'graded'
                      ? 'border-white text-white'
                      : 'border-transparent text-blue-200 hover:text-white'
                  }`}
                >
                  Sudah Dinilai
                </button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {enrichedReports
                .filter(report => {
                  if (literacySubTab === 'needs_grading') return report.status === 'PENDING';
                  return report.status === 'REVIEWED';
                })
                .map((report) => (
                  <div key={report.id} className="glass-effect-dark-card rounded-lg p-4 shadow-sm border border-slate-700">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-slate-100">{report.studentName}</h3>
                        <p className="text-xs text-slate-400">{report.studentClass}</p>
                      </div>
                      <span className="text-xs text-gray-400">
                        {format(report.submissionDate, "d MMM, HH:mm", { locale: id })}
                      </span>
                    </div>
                    <div className="bg-slate-900/30 rounded-md p-3 mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Book className="w-3 h-3 text-blue-500" />
                        <p className="text-xs font-medium text-slate-300">{report.bookTitle}</p>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 italic">"{report.summary}"</p>
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-50">
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />
                        {report.readingDuration}
                      </div>
                      {report.status === 'PENDING' ? (
                        <button
                          onClick={() => openGradeModal(report)}
                          className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-full hover:bg-blue-700 transition-colors shadow-sm"
                        >
                          Nilai Sekarang
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-400">Nilai:</span>
                          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-200">
                            {report.grade || "A"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              {enrichedReports.filter(r => literacySubTab === 'needs_grading' ? r.status === 'PENDING' : r.status === 'REVIEWED').length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-slate-100 font-medium">Tidak ada data literasi</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    {literacySubTab === 'needs_grading' 
                      ? "Semua laporan sudah dinilai!" 
                      : "Belum ada laporan yang dinilai."}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 print:hidden">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Laporan Literasi Siswa</h3>
                <p className="text-sm text-slate-400">
                  Rekap laporan literasi yang dikirim melalui Lentera Digital.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className={dropdownClassName}
                  style={dropdownStyle}
                >
                  <option value="" style={dropdownOptionStyle}>Semua Kelas</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id} style={dropdownOptionStyle}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleExportLiteracy}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Excel
                </button>
              </div>
            </div>

            <div className="border-b border-slate-700">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setAdminLiteracyTab('list')}
                  className={`
                    border-b-2 py-3 px-1 text-sm font-medium transition-colors
                    ${adminLiteracyTab === 'list'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-slate-400 hover:border-gray-300 hover:text-slate-300'
                    }
                  `}
                >
                  Daftar Laporan
                </button>
                <button
                  onClick={() => setAdminLiteracyTab('progress')}
                  className={`
                    border-b-2 py-3 px-1 text-sm font-medium transition-colors
                    ${adminLiteracyTab === 'progress'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-slate-400 hover:border-gray-300 hover:text-slate-300'
                    }
                  `}
                >
                  Status Pengerjaan
                </button>
              </nav>
            </div>

            {adminLiteracyTab === 'list' ? (
              <div className="glass-effect-dark-card rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-slate-900/30">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Tanggal
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Nama Siswa
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Kelas
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Judul Buku
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Durasi
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Nilai
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="glass-effect-dark-card divide-y divide-gray-200">
                      {enrichedReports.map((report) => (
                        <tr key={report.id} className="hover:bg-slate-900/30">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                            {new Date(report.submissionDate).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-slate-100">{report.studentName}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                            {report.studentClass}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-slate-100 line-clamp-1">{report.bookTitle}</div>
                            <div className="text-xs text-slate-400">{report.author}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                            {report.readingDuration}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">
                            {report.grade || "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                report.status === "REVIEWED"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {report.status === "REVIEWED" ? "Sudah Dinilai" : "Menunggu Penilaian"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {enrichedReports.length === 0 && (
                  <div className="px-6 py-8 text-center text-sm text-slate-400">
                    Belum ada laporan literasi yang masuk.
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="glass-effect-dark-card rounded-lg shadow-sm p-4 border-l-4 border-gray-400">
                    <p className="text-xs font-medium text-slate-400">Total Siswa</p>
                    <p className="text-2xl font-bold text-slate-100">{filteredStudents.length}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {selectedClassId ? 'Kelas terpilih' : 'Semua Kelas'}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg shadow-sm p-4 border-l-4 border-green-500">
                    <p className="text-xs font-medium text-green-700">Sudah Aktif Literasi</p>
                    <p className="text-2xl font-bold text-green-700">{completedStudents.length}</p>
                    <p className="text-xs text-green-700 mt-1">
                      {filteredStudents.length > 0
                        ? `${Math.round((completedStudents.length / filteredStudents.length) * 100)}% dari total`
                        : '0% dari total'}
                    </p>
                  </div>
                  <div className="bg-red-50 rounded-lg shadow-sm p-4 border-l-4 border-red-500">
                    <p className="text-xs font-medium text-red-700">Belum Aktif Literasi</p>
                    <p className="text-2xl font-bold text-red-700">{incompleteStudents.length}</p>
                    <p className="text-xs text-red-700 mt-1">
                      {filteredStudents.length > 0
                        ? `${Math.round((incompleteStudents.length / filteredStudents.length) * 100)}% dari total`
                        : '0% dari total'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="glass-effect-dark-card rounded-lg shadow-sm overflow-hidden border border-red-100">
                    <div className="px-6 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-red-700">Belum Aktif Literasi</h4>
                      <span className="text-xs font-medium text-red-700">
                        {incompleteStudents.length} Siswa
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-slate-900/30">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                              No
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                              NISN
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                              Nama Siswa
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                              Kelas
                            </th>
                          </tr>
                        </thead>
                        <tbody className="glass-effect-dark-card divide-y divide-gray-200">
                          {incompleteStudents.map((student, index) => (
                            <tr key={student.id || student.nisn || index} className="hover:bg-red-50/40">
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-400">
                                {index + 1}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-400">
                                {student.nisn || '-'}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs font-medium text-slate-100">
                                {student.name}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-400">
                                {student.class || '-'}
                              </td>
                            </tr>
                          ))}
                          {incompleteStudents.length === 0 && (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-4 py-6 text-center text-xs text-slate-400"
                              >
                                Semua siswa sudah aktif literasi.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="glass-effect-dark-card rounded-lg shadow-sm overflow-hidden border border-green-100">
                    <div className="px-6 py-3 bg-green-50 border-b border-green-100 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-green-700">Sudah Aktif Literasi</h4>
                      <span className="text-xs font-medium text-green-700">
                        {completedStudents.length} Siswa
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-slate-900/30">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                              No
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                              NISN
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                              Nama Siswa
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                              Kelas
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                              Ringkasan Aktivitas
                            </th>
                          </tr>
                        </thead>
                        <tbody className="glass-effect-dark-card divide-y divide-gray-200">
                          {completedStudents.map((student, index) => {
                            const studentStat = literacyStudentStats.find((row) =>
                              matchesStudentIdentity(row.studentId, student.id, student.nisn)
                            );
                            return (
                              <tr key={student.id || student.nisn || index} className="hover:bg-green-50/40">
                                <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-400">
                                  {index + 1}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-400">
                                  {student.nisn || '-'}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-xs font-medium text-slate-100">
                                  {student.name}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-400">
                                  {student.class || '-'}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-400">
                                  {studentStat
                                    ? `${studentStat.borrowCount} pinjam, ${studentStat.reportCount} laporan, ${studentStat.taskSubmissionCount} tugas`
                                    : '-'}
                                </td>
                              </tr>
                            );
                          })}
                          {completedStudents.length === 0 && (
                            <tr>
                              <td
                                colSpan={5}
                                className="px-4 py-6 text-center text-xs text-slate-400"
                              >
                                Belum ada siswa yang aktif literasi.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )
      ) : activeTab === 'stats' ? (
        <div className="space-y-6 print:hidden">
          <div className="glass-effect-dark-card rounded-xl border border-slate-700 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Statistik Aktivitas Literasi</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Fokus pada keterlibatan literasi yang objektif: hari aktif di Lentera, peminjaman atau laporan bacaan, serta pengerjaan tugas literasi.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className={dropdownClassName}
                  style={dropdownStyle}
                >
                  <option value="" style={dropdownOptionStyle}>Semua Kelas</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id} style={dropdownOptionStyle}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={statsMonth}
                  onChange={(e) => setStatsMonth(Number(e.target.value))}
                  className={dropdownClassName}
                  style={dropdownStyle}
                >
                  {LIBRARY_MONTHS.map((month, index) => (
                    <option key={month} value={index + 1} style={dropdownOptionStyle}>
                      {month}
                    </option>
                  ))}
                </select>
                <select
                  value={statsYear}
                  onChange={(e) => setStatsYear(Number(e.target.value))}
                  className={dropdownClassName}
                  style={dropdownStyle}
                >
                  {Array.from({ length: 2030 - 2024 + 1 }, (_, index) => 2024 + index).map((year) => (
                    <option key={year} value={year} style={dropdownOptionStyle}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="glass-effect-dark-card rounded-xl border border-slate-700 p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-400">Siswa Aktif Literasi</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-100">{literacyTotals.activeStudents}</h3>
              <p className="mt-1 text-xs text-slate-400">Punya aktivitas pada periode terpilih</p>
            </div>
            <div className="glass-effect-dark-card rounded-xl border border-slate-700 p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-400">Hari Aktif Lentera</p>
              <h3 className="mt-2 text-2xl font-bold text-yellow-300">{literacyTotals.totalVisitDays}</h3>
              <p className="mt-1 text-xs text-slate-400">Akumulasi hari aktif siswa</p>
            </div>
            <div className="glass-effect-dark-card rounded-xl border border-slate-700 p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-400">Peminjaman Buku</p>
              <h3 className="mt-2 text-2xl font-bold text-green-300">{literacyTotals.totalBorrows}</h3>
              <p className="mt-1 text-xs text-slate-400">Transaksi pinjam pada periode ini</p>
            </div>
            <div className="glass-effect-dark-card rounded-xl border border-slate-700 p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-400">Laporan Bacaan</p>
              <h3 className="mt-2 text-2xl font-bold text-cyan-200">{literacyTotals.totalReports}</h3>
              <p className="mt-1 text-xs text-slate-400">Pengiriman ringkasan/laporan</p>
            </div>
            <div className="glass-effect-dark-card rounded-xl border border-slate-700 p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-400">Tugas Dikerjakan</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-100">{literacyTotals.totalTasksDone}</h3>
              <p className="mt-1 text-xs text-slate-400">Submit tugas yang tercatat</p>
            </div>
            <div className="glass-effect-dark-card rounded-xl border border-slate-700 p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-400">Skor Rata-rata</p>
              <h3 className="mt-2 text-2xl font-bold text-red-300">{literacyTotals.averageScore}</h3>
              <p className="mt-1 text-xs text-slate-400">Indeks aktivitas literasi</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="glass-effect-dark-card rounded-xl border border-slate-700 p-5 shadow-sm">
              <div className="text-lg font-semibold text-slate-100">Rule Final</div>
              <div className="mt-4 space-y-3">
                {literacyRuleSummary.map((item) => (
                  <div key={item} className="rounded-lg border border-slate-700/60 bg-slate-900/30 px-4 py-3 text-sm text-slate-300">
                    {item}
                  </div>
                ))}
                <div className="rounded-lg border border-cyan-700/40 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100">
                  <div className="font-semibold">Rumus Skor</div>
                  <div className="mt-1 text-cyan-100/90">{literacyScoreFormula}</div>
                </div>
              </div>
            </div>

            <div className="glass-effect-dark-card rounded-xl border border-slate-700 p-5 shadow-sm">
              <div className="text-lg font-semibold text-slate-100">Sumber Data</div>
              <div className="mt-4 space-y-3">
                {literacyMonitoringSourceSummary.map((item) => (
                  <div key={item} className="rounded-lg border border-slate-700/60 bg-slate-900/30 px-4 py-3 text-sm text-slate-300">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-effect-dark-card rounded-xl border border-slate-700 p-5 shadow-sm lg:col-span-1">
              <div className="text-lg font-semibold text-slate-100">Per Kelas</div>
              <div className="mt-1 text-sm text-slate-400">Ringkasan keterlibatan literasi berdasarkan kelas pada periode terpilih</div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-700">
                  <thead className="bg-slate-900/30">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Kelas</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Siswa</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Aktif</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Pinjam</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Laporan</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Tugas</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Skor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {classReportStats.map((row) => (
                      <tr key={row.className} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-sm font-semibold text-slate-100">{row.className}</td>
                        <td className="px-4 py-3 text-right text-sm text-slate-200">{row.students}</td>
                        <td className="px-4 py-3 text-right text-sm text-green-200">{row.activeStudents}</td>
                        <td className="px-4 py-3 text-right text-sm text-slate-200">{row.borrowCount}</td>
                        <td className="px-4 py-3 text-right text-sm text-slate-200">{row.reportCount}</td>
                        <td className="px-4 py-3 text-right text-sm text-slate-200">{row.taskCount}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-cyan-200">{row.avgScore}</td>
                      </tr>
                    ))}
                    {classReportStats.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                          Belum ada aktivitas literasi pada periode ini.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="glass-effect-dark-card rounded-xl border border-slate-700 p-5 shadow-sm lg:col-span-2">
              <div className="text-lg font-semibold text-slate-100">Top Siswa Aktif</div>
              <div className="mt-1 text-sm text-slate-400">Peringkat berdasarkan skor aktivitas literasi pada periode terpilih</div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-700">
                  <thead className="bg-slate-900/30">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Siswa</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Hari Aktif</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Pinjam</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Laporan</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Tugas</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Skor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {topLiteracyStudents.map((row, index) => (
                      <tr key={row.studentId || `${row.studentName}-${index}`} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-sm text-slate-300">{index + 1}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-semibold text-slate-100">{row.studentName}</div>
                          <div className="text-xs text-slate-400">{row.studentClass} • {row.studentNisn || "-"}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-200">{row.visitDays}</td>
                        <td className="px-4 py-3 text-right text-sm text-slate-200">{row.borrowCount}</td>
                        <td className="px-4 py-3 text-right text-sm text-slate-200">{row.reportCount}</td>
                        <td className="px-4 py-3 text-right text-sm text-slate-200">{row.taskSubmissionCount}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-cyan-200">{row.finalScore}</td>
                      </tr>
                    ))}
                    {topLiteracyStudents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                          Belum ada aktivitas siswa pada periode ini.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-effect-dark-card rounded-xl border border-slate-700 p-5 shadow-sm">
              <div className="text-lg font-semibold text-slate-100">Distribusi Aktivitas</div>
              <div className="mt-1 text-sm text-slate-400">Kondisi siswa pada periode terpilih</div>
              <div className="mt-4">
                {literacyDistributionData.some((item) => item.value > 0) ? (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={literacyDistributionData.filter((item) => item.value > 0)}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={92}
                          paddingAngle={3}
                          stroke="#0f172a"
                          strokeWidth={2}
                        >
                          {literacyDistributionData
                            .filter((item) => item.value > 0)
                            .map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number, name: string) => [`${value} siswa`, name]}
                          contentStyle={{
                            backgroundColor: "#020617",
                            borderColor: "#334155",
                            borderRadius: "0.75rem",
                            color: "#e2e8f0",
                          }}
                          itemStyle={{ color: "#e2e8f0" }}
                          labelStyle={{ color: "#94a3b8" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/30 px-4 py-8 text-center text-sm text-slate-400">
                    Belum ada aktivitas untuk ditampilkan dalam diagram.
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-3">
                {literacyDistributionData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-lg border border-slate-700/60 bg-slate-900/30 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm font-medium text-slate-300">{item.name}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-100">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'tasks' ? (
        user?.role === 'teacher' ? (
          <div className="min-h-screen bg-slate-900/30 -mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
            <div className="bg-blue-600 px-4 pt-6 pb-0 shadow-md">
              <div className="flex items-center justify-between text-white mb-4">
                <div className="flex items-center">
                  <button onClick={() => router.back()} className="mr-4">
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <h1 className="text-xl font-bold">Tugas Literasi</h1>
                </div>
                <button
                  onClick={() => setShowTaskModal(true)}
                  className="p-2 glass-effect-dark-card/20 rounded-full hover:glass-effect-dark-card/30 transition-colors"
                >
                  <Plus className="w-5 h-5 text-white" />
                </button>
              </div>
              <div className="flex text-center">
                <button
                  onClick={() => setTaskSubTab('active')}
                  className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
                    taskSubTab === 'active'
                      ? 'border-white text-white'
                      : 'border-transparent text-blue-200 hover:text-white'
                  }`}
                >
                  Aktif
                </button>
                <button
                  onClick={() => setTaskSubTab('draft')}
                  className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
                    taskSubTab === 'draft'
                      ? 'border-white text-white'
                      : 'border-transparent text-blue-200 hover:text-white'
                  }`}
                >
                  Draft / Arsip
                </button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {literacyTasks
                .filter((task) => {
                  if (taskSubTab === 'active') return task.isActive;
                  return !task.isActive;
                })
                .map((task) => (
                  <div key={task.id} className="glass-effect-dark-card rounded-lg p-4 shadow-sm border border-slate-700">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-slate-100 line-clamp-1">{task.title}</h3>
                        <p className="text-xs text-slate-400">
                          {new Date(task.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                          task.isActive
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                        }`}
                      >
                        {task.isActive ? 'Terkirim' : 'Draft'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 mb-3">{task.description}</p>
                    <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Star className="w-3 h-3 text-yellow-500" />
                          {task.points} Poin
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="w-3 h-3" />
                          {task.durationMinutes} Menit
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await toggleTaskStatus(task.id, !task.isActive);
                          } catch (error: any) {
                            toast.error(error?.message || "Gagal mengubah status tugas.");
                          }
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors shadow-sm ${
                          task.isActive
                            ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {task.isActive ? 'Tarik Kembali' : 'Terbitkan'}
                      </button>
                    </div>
                  </div>
                ))}
              {literacyTasks.filter((t) => (taskSubTab === 'active' ? t.isActive : !t.isActive)).length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                    <Book className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-slate-100 font-medium">Tidak ada tugas</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    {taskSubTab === 'active'
                      ? 'Belum ada tugas yang diterbitkan.'
                      : 'Tidak ada draft tugas tersimpan.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="glass-effect-dark-card rounded-lg shadow-sm p-6 print:hidden">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">{adminTaskTitle}</h3>
                <p className="text-sm text-slate-400">{adminTaskDescription}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                {adminTaskView !== 'tasks' && (
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className={dropdownClassName}
                    style={dropdownStyle}
                  >
                    <option value="" style={dropdownOptionStyle}>Semua Kelas</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id} style={dropdownOptionStyle}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
                {adminTaskView === 'tasks' && (
                  <button
                    onClick={() => {
                      resetTaskForm();
                      setShowTaskModal(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700"
                  >
                    <Plus className="w-4 h-4" />
                    Buat Tugas Baru
                  </button>
                )}
              </div>
            </div>
            <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-700/60 pb-4">
              <button
                onClick={() => navigateToAdminTaskView('tasks')}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  adminTaskView === 'tasks'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                Daftar Tugas
              </button>
              <button
                onClick={() => navigateToAdminTaskView('needs-grading')}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  adminTaskView === 'needs-grading'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                Perlu Dinilai
              </button>
              <button
                onClick={() => navigateToAdminTaskView('history')}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  adminTaskView === 'history'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                Riwayat
              </button>
            </div>
            {adminTaskView === 'tasks' ? (
              literacyTasks.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-slate-900/30">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Judul Tugas
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Poin
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Durasi
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Dibuat Pada
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="glass-effect-dark-card divide-y divide-gray-200">
                      {literacyTasks.map((task) => (
                        <tr key={task.id} className="hover:bg-slate-900/30">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-slate-100 line-clamp-1">{task.title}</div>
                            <div className="text-xs text-slate-400 line-clamp-2">{task.description}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">
                            {task.points} Poin
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                            {task.durationMinutes} Menit
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                task.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {task.isActive ? 'Terkirim' : 'Draft'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                            {new Date(task.createdAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => openTaskModalForEdit(task)}
                                className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-200 transition-colors hover:bg-blue-500/20"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    await toggleTaskStatus(task.id, !task.isActive);
                                  } catch (error: any) {
                                    toast.error(error?.message || "Gagal mengubah status tugas.");
                                  }
                                }}
                                className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                                  task.isActive
                                    ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                              >
                                {task.isActive ? 'Tarik Kembali' : 'Terbitkan'}
                              </button>
                              <button
                                onClick={() => handleDeleteTask(task)}
                                className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-200 transition-colors hover:bg-red-500/20"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-slate-400">
                  Belum ada tugas literasi. Gunakan tombol `Buat Tugas Baru` untuk mulai membagikan tugas ke siswa.
                </div>
              )
            ) : adminTaskView === 'needs-grading' ? (
              pendingReports.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-slate-900/30">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Tanggal</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Nama Siswa</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Kelas</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Judul Buku</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Durasi</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="glass-effect-dark-card divide-y divide-gray-200">
                      {pendingReports.map((report) => (
                        <tr key={report.id} className="hover:bg-slate-900/30">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                            {new Date(report.submissionDate).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-100">{report.studentName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{report.studentClass}</td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-slate-100 line-clamp-1">{report.bookTitle}</div>
                            <div className="text-xs text-slate-400">{report.author}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{report.readingDuration}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              Menunggu Penilaian
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => openGradeModal(report)}
                              className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                            >
                              Nilai Sekarang
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-slate-400">
                  Tidak ada laporan yang perlu dinilai.
                </div>
              )
            ) : (
              reviewedReports.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-slate-900/30">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Tanggal</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Nama Siswa</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Kelas</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Judul Buku</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Nilai</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="glass-effect-dark-card divide-y divide-gray-200">
                      {reviewedReports.map((report) => (
                        <tr key={report.id} className="hover:bg-slate-900/30">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                            {new Date(report.submissionDate).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-100">{report.studentName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{report.studentClass}</td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-slate-100 line-clamp-1">{report.bookTitle}</div>
                            <div className="text-xs text-slate-400">{report.author}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">{report.grade || "-"}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Sudah Dinilai
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => openGradeModal(report)}
                              className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-100 hover:bg-white/10"
                            >
                              Lihat Detail
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-slate-400">
                  Belum ada riwayat penilaian literasi.
                </div>
              )
            )}
          </div>
        )
      ) : null}

      {/* Signature Section for Print */}
      <div className="hidden print:flex justify-end mt-12 px-8">
        <div className="text-center">
          <p className="text-black mb-20">Pacet, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p className="text-black font-bold border-b border-black inline-block min-w-[200px]">Kepala Perpustakaan</p>
          <p className="text-black mt-1">NIP. .......................</p>
        </div>
      </div>

      {/* Manual Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="glass-effect-dark-card rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100">
                  {editingTaskId ? 'Edit Tugas Literasi' : 'Buat Tugas Literasi'}
                </h3>
                <p className="text-sm text-slate-400">
                  {editingTaskId
                    ? 'Perbarui detail tugas tanpa mengubah sekolah dan histori penerbitannya.'
                    : 'Tugas ini akan masuk ke Lentera Digital siswa sesuai sekolah yang sedang login.'}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowTaskModal(false);
                  resetTaskForm();
                }}
                className="text-gray-400 hover:text-slate-400"
              >
                <span className="sr-only">Close</span>
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-100">
                {settingsLoading
                  ? "Memuat default tugas dari pengaturan sekolah..."
                  : `Default sekolah: ${taskDefaults.defaultPoints} poin, ${taskDefaults.defaultDurationMinutes} menit.`}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Judul Tugas</label>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-100 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                  placeholder="Contoh: Membaca Cerpen"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Deskripsi / Instruksi</label>
                <textarea
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-100 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                  placeholder="Jelaskan detail tugas..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300">Poin</label>
                  <input
                    type="number"
                    value={newTaskPoints}
                    onChange={(e) => setNewTaskPoints(Number(e.target.value))}
                    className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-100 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Durasi (Menit)</label>
                  <input
                    type="number"
                    value={newTaskDuration}
                    onChange={(e) => setNewTaskDuration(Number(e.target.value))}
                    className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-100 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3 border-t border-white/10 pt-4">
                {!editingTaskId && (
                  <button
                    onClick={() => handleCreateTask(true)}
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-2 text-slate-200 font-medium hover:bg-slate-900/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    Simpan sebagai Draft
                  </button>
                )}
                <button
                  onClick={() => handleCreateTask(false)}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  {editingTaskId ? 'Simpan Perubahan' : 'Kirim ke Siswa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="glass-effect-dark-card rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Detail Laporan Literasi</h3>
                <p className="text-sm text-slate-400">{selectedReport.studentName} - {selectedReport.studentClass}</p>
              </div>
              <button 
                onClick={() => setSelectedReport(null)}
                className="text-gray-400 hover:text-slate-400"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-slate-900/30 p-3 rounded-md">
                <p className="text-xs text-slate-400 mb-1">Judul Buku</p>
                <p className="text-sm font-medium text-slate-100">{selectedReport.bookTitle}</p>
                <p className="text-xs text-slate-400 mt-1">Penulis: {selectedReport.author}</p>
              </div>
              
              <div>
                <p className="text-xs text-slate-400 mb-1">Ringkasan / Hikmah</p>
                <div className="p-3 border border-slate-700 rounded-md glass-effect-dark-card text-sm text-gray-800 max-h-60 overflow-y-auto">
                  {selectedReport.summary}
                </div>
              </div>

              {selectedReport.status === 'REVIEWED' ? (
                <div className="bg-green-50 p-3 rounded-md border border-green-100">
                  <p className="text-xs text-green-700 font-medium mb-1">Feedback Guru:</p>
                  <p className="text-sm text-green-800">{selectedReport.feedback}</p>
                </div>
              ) : (
                <div className="bg-yellow-50 p-3 rounded-md border border-yellow-100">
                  <label htmlFor="feedback" className="block text-xs font-medium text-yellow-800 mb-1">
                    Berikan Penilaian / Feedback
                  </label>
                  <textarea
                    id="feedback"
                    rows={3}
                    className="w-full text-sm border-yellow-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500 p-2"
                    placeholder="Tulis tanggapan untuk siswa..."
                    value={feedbackInput}
                    onChange={(e) => setFeedbackInput(e.target.value)}
                  ></textarea>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 bg-slate-800/50 text-slate-300 rounded-md text-sm font-medium hover:bg-gray-200"
              >
                Tutup
              </button>
              {selectedReport.status === 'PENDING' && (
                <button
                  onClick={handleReviewSubmit}
                  disabled={!feedbackInput.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Kirim Penilaian
                </button>
              )}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );

  if (!_hasHydrated) return <div className="min-h-screen bg-slate-950" />;
  return libraryContent;
}

export default function LibraryPage(props: LibraryPageProps = {}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <LibraryPageContent {...props} />
    </Suspense>
  );
}
