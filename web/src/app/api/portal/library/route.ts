import { NextRequest, NextResponse } from "next/server";
import { getGasAdminDb, getGasAdminFirestore } from "@/lib/server/firebaseAdmin";
import { requirePortalSession } from "@/lib/server/portalSession";

type LibraryPayload = {
  action?:
    | "borrow-book"
    | "return-book"
    | "submit-report"
    | "review-report"
    | "create-task"
    | "toggle-task-status"
    | "update-task"
    | "delete-task";
  studentId?: string;
  bookId?: string;
  recordId?: string;
  reportId?: string;
  taskId?: string;
  grade?: string;
  feedback?: string;
  report?: {
    studentId?: string;
    bookTitle?: string;
    author?: string;
    readingDuration?: string;
    summary?: string;
  };
  task?: {
    title?: string;
    description?: string;
    points?: number;
    durationMinutes?: number;
    isActive?: boolean;
    createdAt?: number;
  };
  isActive?: boolean;
};

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeSchoolId(value: unknown) {
  return normalizeText(value).toLowerCase();
}

async function getTeacherContext(teacherId: string, schoolId: string) {
  const snapshot = await getGasAdminDb().ref(`master_teachers/${teacherId}`).get();
  if (!snapshot.exists()) throw new Error("Akun guru tidak ditemukan.");
  const teacher = snapshot.val() || {};
  if (normalizeSchoolId(teacher.schoolId) !== schoolId) {
    throw new Error("Guru berada di luar sekolah aktif.");
  }
  const status = normalizeText(teacher.status).toLowerCase();
  if (status === "inactive" || status === "nonaktif") {
    throw new Error("Akun guru sedang nonaktif.");
  }
  return teacher;
}

async function getStudentContext(studentId: string, schoolId: string) {
  const snapshot = await getGasAdminDb().ref(`master_students/${studentId}`).get();
  if (!snapshot.exists()) throw new Error("Akun siswa tidak ditemukan.");
  const student = snapshot.val() || {};
  if (normalizeSchoolId(student.schoolId) !== schoolId) {
    throw new Error("Siswa berada di luar sekolah aktif.");
  }
  const status = normalizeText(student.status).toLowerCase();
  if (status === "inactive" || status === "nonaktif" || status === "graduated" || status === "transferred") {
    throw new Error("Akun siswa tidak aktif.");
  }
  return student;
}

async function borrowBook(payload: LibraryPayload) {
  const session = requirePortalSession(["student"]);
  const schoolId = normalizeSchoolId(session.user.schoolId);
  const studentId = normalizeText(payload.studentId);
  const bookId = normalizeText(payload.bookId);
  const sessionStudentId = normalizeText(session.user.nisn || session.user.id);
  if (!studentId || !bookId) throw new Error("studentId dan bookId wajib diisi.");
  if (studentId !== sessionStudentId) throw new Error("Siswa hanya boleh meminjam untuk akunnya sendiri.");

  const student = await getStudentContext(studentId, schoolId);
  const firestore = getGasAdminFirestore();
  const bookRef = firestore.collection("books").doc(bookId);
  const bookSnap = await bookRef.get();
  if (!bookSnap.exists) throw new Error("Buku tidak ditemukan.");
  const book = bookSnap.data() || {};
  const available = Number(book.available ?? book.stock ?? 0);
  if (available <= 0) throw new Error("Stok buku habis.");

  const recordRef = getGasAdminDb().ref("borrow_records").push();
  await recordRef.set({
    bookId,
    studentId,
    borrowDate: Date.now(),
    dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
    returnDate: null,
    status: "BORROWED",
    fines: 0,
    schoolId,
    schoolName: normalizeText(student.schoolName || session.user.schoolName),
  });
  await bookRef.update({ available: available - 1 });
}

async function returnBook(payload: LibraryPayload) {
  const session = requirePortalSession(["teacher"]);
  const schoolId = normalizeSchoolId(session.user.schoolId);
  await getTeacherContext(session.user.nuptk || session.user.id, schoolId);

  const recordId = normalizeText(payload.recordId);
  if (!recordId) throw new Error("recordId wajib diisi.");
  const recordRef = getGasAdminDb().ref(`borrow_records/${recordId}`);
  const recordSnap = await recordRef.get();
  if (!recordSnap.exists()) throw new Error("Record peminjaman tidak ditemukan.");
  const record = recordSnap.val() || {};
  if (normalizeSchoolId(record.schoolId) !== schoolId) {
    throw new Error("Record peminjaman berada di sekolah lain.");
  }

  await recordRef.update({
    returnDate: Date.now(),
    status: "RETURNED",
  });

  const firestore = getGasAdminFirestore();
  const bookRef = firestore.collection("books").doc(normalizeText(record.bookId));
  const bookSnap = await bookRef.get();
  if (bookSnap.exists) {
    const book = bookSnap.data() || {};
    const stock = Number(book.stock ?? 0);
    const available = Number(book.available ?? stock);
    await bookRef.update({ available: stock > 0 ? Math.min(stock, available + 1) : available + 1 });
  }
}

async function submitReport(payload: LibraryPayload) {
  const session = requirePortalSession(["student"]);
  const schoolId = normalizeSchoolId(session.user.schoolId);
  const sessionStudentId = normalizeText(session.user.nisn || session.user.id);
  const report = payload.report || {};
  const studentId = normalizeText(report.studentId);
  if (!studentId || studentId !== sessionStudentId) {
    throw new Error("Siswa hanya boleh mengirim laporan untuk akunnya sendiri.");
  }

  const student = await getStudentContext(studentId, schoolId);
  const reportRef = getGasAdminDb().ref("literacy_reports").push();
  await reportRef.set({
    studentId,
    bookTitle: normalizeText(report.bookTitle) || "Tanpa Judul",
    author: normalizeText(report.author) || "-",
    readingDuration: normalizeText(report.readingDuration) || "-",
    summary: normalizeText(report.summary),
    submissionDate: Date.now(),
    status: "PENDING",
    schoolId,
    schoolName: normalizeText(student.schoolName || session.user.schoolName),
  });
}

async function reviewReport(payload: LibraryPayload) {
  const session = requirePortalSession(["teacher"]);
  const schoolId = normalizeSchoolId(session.user.schoolId);
  await getTeacherContext(session.user.nuptk || session.user.id, schoolId);

  const reportId = normalizeText(payload.reportId);
  if (!reportId) throw new Error("reportId wajib diisi.");
  const reportRef = getGasAdminDb().ref(`literacy_reports/${reportId}`);
  const reportSnap = await reportRef.get();
  if (!reportSnap.exists()) throw new Error("Laporan literasi tidak ditemukan.");
  const report = reportSnap.val() || {};
  if (normalizeSchoolId(report.schoolId) !== schoolId) {
    throw new Error("Laporan berasal dari sekolah lain.");
  }

  await reportRef.update({
    status: "REVIEWED",
    grade: normalizeText(payload.grade) || "A",
    feedback: normalizeText(payload.feedback),
  });
}

async function createTask(payload: LibraryPayload) {
  const session = requirePortalSession(["teacher"]);
  const schoolId = normalizeSchoolId(session.user.schoolId);
  await getTeacherContext(session.user.nuptk || session.user.id, schoolId);

  const task = payload.task || {};
  const title = normalizeText(task.title);
  const description = normalizeText(task.description);
  if (!title || !description) throw new Error("Judul dan deskripsi tugas wajib diisi.");

  const taskRef = getGasAdminDb().ref("literacy_tasks").push();
  await taskRef.set({
    title,
    description,
    points: Number(task.points || 0),
    durationMinutes: Number(task.durationMinutes || 0),
    isActive: task.isActive === true,
    createdAt: Number(task.createdAt || Date.now()),
    schoolId,
    schoolName: normalizeText(session.user.schoolName),
  });
}

async function toggleTaskStatus(payload: LibraryPayload) {
  const session = requirePortalSession(["teacher"]);
  const schoolId = normalizeSchoolId(session.user.schoolId);
  await getTeacherContext(session.user.nuptk || session.user.id, schoolId);

  const taskId = normalizeText(payload.taskId);
  if (!taskId) throw new Error("taskId wajib diisi.");
  const taskRef = getGasAdminDb().ref(`literacy_tasks/${taskId}`);
  const taskSnap = await taskRef.get();
  if (!taskSnap.exists()) throw new Error("Tugas literasi tidak ditemukan.");
  const task = taskSnap.val() || {};
  if (normalizeSchoolId(task.schoolId) !== schoolId) {
    throw new Error("Tugas berasal dari sekolah lain.");
  }

  await taskRef.update({ isActive: payload.isActive === true });
}

async function updateTask(payload: LibraryPayload) {
  const session = requirePortalSession(["teacher"]);
  const schoolId = normalizeSchoolId(session.user.schoolId);
  await getTeacherContext(session.user.nuptk || session.user.id, schoolId);

  const taskId = normalizeText(payload.taskId);
  if (!taskId) throw new Error("taskId wajib diisi.");

  const taskRef = getGasAdminDb().ref(`literacy_tasks/${taskId}`);
  const taskSnap = await taskRef.get();
  if (!taskSnap.exists()) throw new Error("Tugas literasi tidak ditemukan.");
  const existingTask = taskSnap.val() || {};
  if (normalizeSchoolId(existingTask.schoolId) !== schoolId) {
    throw new Error("Tugas berasal dari sekolah lain.");
  }

  const task = payload.task || {};
  const title = normalizeText(task.title);
  const description = normalizeText(task.description);
  if (!title || !description) throw new Error("Judul dan deskripsi tugas wajib diisi.");

  await taskRef.update({
    title,
    description,
    points: Number(task.points || 0),
    durationMinutes: Number(task.durationMinutes || 0),
  });
}

async function deleteTask(payload: LibraryPayload) {
  const session = requirePortalSession(["teacher"]);
  const schoolId = normalizeSchoolId(session.user.schoolId);
  await getTeacherContext(session.user.nuptk || session.user.id, schoolId);

  const taskId = normalizeText(payload.taskId);
  if (!taskId) throw new Error("taskId wajib diisi.");

  const taskRef = getGasAdminDb().ref(`literacy_tasks/${taskId}`);
  const taskSnap = await taskRef.get();
  if (!taskSnap.exists()) throw new Error("Tugas literasi tidak ditemukan.");
  const task = taskSnap.val() || {};
  if (normalizeSchoolId(task.schoolId) !== schoolId) {
    throw new Error("Tugas berasal dari sekolah lain.");
  }

  await taskRef.remove();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LibraryPayload;
    if (body.action === "borrow-book") {
      await borrowBook(body);
      return NextResponse.json({ success: true, message: "Peminjaman buku berhasil diproses." });
    }
    if (body.action === "return-book") {
      await returnBook(body);
      return NextResponse.json({ success: true, message: "Pengembalian buku berhasil diproses." });
    }
    if (body.action === "submit-report") {
      await submitReport(body);
      return NextResponse.json({ success: true, message: "Laporan literasi berhasil dikirim." });
    }
    if (body.action === "review-report") {
      await reviewReport(body);
      return NextResponse.json({ success: true, message: "Laporan literasi berhasil dinilai." });
    }
    if (body.action === "create-task") {
      await createTask(body);
      return NextResponse.json({ success: true, message: "Tugas literasi berhasil dibuat." });
    }
    if (body.action === "toggle-task-status") {
      await toggleTaskStatus(body);
      return NextResponse.json({ success: true, message: "Status tugas literasi berhasil diubah." });
    }
    if (body.action === "update-task") {
      await updateTask(body);
      return NextResponse.json({ success: true, message: "Tugas literasi berhasil diperbarui." });
    }
    if (body.action === "delete-task") {
      await deleteTask(body);
      return NextResponse.json({ success: true, message: "Tugas literasi berhasil dihapus." });
    }

    return NextResponse.json(
      { success: false, message: "Aksi library portal tidak valid." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: String(error?.message || error) },
      { status: 400 }
    );
  }
}
