import { NextRequest, NextResponse } from "next/server";
import { getGasAdminDb, getGasAdminFirestore } from "@/lib/server/firebaseAdmin";
import { enforceAdminCapability } from "@/lib/server/adminPolicy";
import { writeEduLockAuditEvent } from "@/lib/server/edulockAudit";

type LibraryPayload = {
  action?:
    | "borrow-book"
    | "return-book"
    | "submit-report"
    | "review-report"
    | "create-task"
    | "toggle-task-status";
  schoolId?: string;
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

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSchoolId(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

async function getStudentMeta(studentId: string) {
  const snapshot = await getGasAdminDb().ref(`master_students/${studentId}`).get();
  if (!snapshot.exists()) {
    throw new Error("Siswa Lentera tidak ditemukan di database inti.");
  }
  const value = snapshot.val() || {};
  return {
    schoolId: normalizeSchoolId(value.schoolId),
    schoolName: normalizeText(value.schoolName),
    studentName: normalizeText(value.name),
  };
}

async function borrowBook(payload: LibraryPayload, authorizationHeader?: string | null) {
  const requestedSchoolId = normalizeSchoolId(payload.schoolId);
  const context = await enforceAdminCapability(authorizationHeader, "library.write", {
    requestedSchoolId,
  });

  const studentId = normalizeText(payload.studentId);
  const bookId = normalizeText(payload.bookId);
  if (!studentId || !bookId) {
    throw new Error("studentId dan bookId wajib diisi.");
  }

  const studentMeta = await getStudentMeta(studentId);
  if (studentMeta.schoolId !== context.schoolId) {
    throw new Error("Siswa peminjam berasal dari sekolah lain.");
  }

  const firestore = getGasAdminFirestore();
  const bookRef = firestore.collection("books").doc(bookId);
  const bookSnap = await bookRef.get();
  if (!bookSnap.exists) {
    throw new Error("Buku tidak ditemukan.");
  }

  const book = bookSnap.data() || {};
  const available = Number(book.available ?? book.stock ?? 0);
  if (available <= 0) {
    throw new Error("Stok buku habis.");
  }

  const recordRef = getGasAdminDb().ref("borrow_records").push();
  await recordRef.set({
    bookId,
    studentId,
    borrowDate: Date.now(),
    dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
    returnDate: null,
    status: "BORROWED",
    fines: 0,
    schoolId: context.schoolId,
    schoolName: studentMeta.schoolName || context.profile.schoolName,
  });
  await bookRef.update({ available: available - 1 });

  await writeEduLockAuditEvent(context.profile, {
    type: "LIBRARY_BORROW",
    message: `Membuat transaksi peminjaman buku ${bookId} untuk siswa ${studentId}.`,
    schoolId: context.schoolId,
    targetId: recordRef.key || undefined,
    metadata: { studentId, bookId },
  });
}

async function returnBook(payload: LibraryPayload, authorizationHeader?: string | null) {
  const recordId = normalizeText(payload.recordId);
  if (!recordId) throw new Error("recordId wajib diisi.");

  const recordSnap = await getGasAdminDb().ref(`borrow_records/${recordId}`).get();
  if (!recordSnap.exists()) {
    throw new Error("Record peminjaman tidak ditemukan.");
  }
  const record = recordSnap.val() || {};
  const context = await enforceAdminCapability(authorizationHeader, "library.write", {
    requestedSchoolId: normalizeSchoolId(record.schoolId || payload.schoolId),
  });
  if (normalizeSchoolId(record.schoolId) !== context.schoolId) {
    throw new Error("Record peminjaman berasal dari sekolah lain.");
  }

  await getGasAdminDb().ref(`borrow_records/${recordId}`).update({
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
    const nextAvailable = stock > 0 ? Math.min(stock, available + 1) : available + 1;
    await bookRef.update({ available: nextAvailable });
  }

  await writeEduLockAuditEvent(context.profile, {
    type: "LIBRARY_RETURN",
    message: `Mengembalikan buku untuk record ${recordId}.`,
    schoolId: context.schoolId,
    targetId: recordId,
    metadata: { bookId: normalizeText(record.bookId), studentId: normalizeText(record.studentId) },
  });
}

async function submitReport(payload: LibraryPayload, authorizationHeader?: string | null) {
  const requestedSchoolId = normalizeSchoolId(payload.schoolId);
  const context = await enforceAdminCapability(authorizationHeader, "library.write", {
    requestedSchoolId,
  });
  const report = payload.report || {};
  const studentId = normalizeText(report.studentId);
  if (!studentId) {
    throw new Error("studentId laporan wajib diisi.");
  }

  const studentMeta = await getStudentMeta(studentId);
  if (studentMeta.schoolId !== context.schoolId) {
    throw new Error("Laporan literasi ini berasal dari sekolah lain.");
  }

  const reportRef = getGasAdminDb().ref("literacy_reports").push();
  await reportRef.set({
    studentId,
    bookTitle: normalizeText(report.bookTitle) || "Tanpa Judul",
    author: normalizeText(report.author) || "-",
    readingDuration: normalizeText(report.readingDuration) || "-",
    summary: normalizeText(report.summary),
    submissionDate: Date.now(),
    status: "PENDING",
    schoolId: context.schoolId,
    schoolName: studentMeta.schoolName || context.profile.schoolName,
  });

  await writeEduLockAuditEvent(context.profile, {
    type: "LIBRARY_REPORT_SUBMIT",
    message: `Menerima laporan literasi untuk siswa ${studentId}.`,
    schoolId: context.schoolId,
    targetId: reportRef.key || undefined,
  });
}

async function reviewReport(payload: LibraryPayload, authorizationHeader?: string | null) {
  const reportId = normalizeText(payload.reportId);
  if (!reportId) throw new Error("reportId wajib diisi.");

  const reportSnap = await getGasAdminDb().ref(`literacy_reports/${reportId}`).get();
  if (!reportSnap.exists()) {
    throw new Error("Laporan literasi tidak ditemukan.");
  }
  const report = reportSnap.val() || {};
  const context = await enforceAdminCapability(authorizationHeader, "library.write", {
    requestedSchoolId: normalizeSchoolId(report.schoolId || payload.schoolId),
  });
  if (normalizeSchoolId(report.schoolId) !== context.schoolId) {
    throw new Error("Laporan literasi berasal dari sekolah lain.");
  }

  await getGasAdminDb().ref(`literacy_reports/${reportId}`).update({
    status: "REVIEWED",
    grade: normalizeText(payload.grade) || "A",
    feedback: normalizeText(payload.feedback),
  });

  await writeEduLockAuditEvent(context.profile, {
    type: "LIBRARY_REPORT_REVIEW",
    message: `Menilai laporan literasi ${reportId}.`,
    schoolId: context.schoolId,
    targetId: reportId,
    metadata: { grade: normalizeText(payload.grade) || "A" },
  });
}

async function createTask(payload: LibraryPayload, authorizationHeader?: string | null) {
  const requestedSchoolId = normalizeSchoolId(payload.schoolId);
  const context = await enforceAdminCapability(authorizationHeader, "library.write", {
    requestedSchoolId,
  });
  const task = payload.task || {};
  const title = normalizeText(task.title);
  const description = normalizeText(task.description);
  if (!title || !description) {
    throw new Error("Judul dan deskripsi tugas wajib diisi.");
  }

  const taskRef = getGasAdminDb().ref("literacy_tasks").push();
  await taskRef.set({
    title,
    description,
    points: Number(task.points || 0),
    durationMinutes: Number(task.durationMinutes || 0),
    isActive: task.isActive === true,
    createdAt: Number(task.createdAt || Date.now()),
    schoolId: context.schoolId,
    schoolName: context.profile.schoolName,
  });

  await writeEduLockAuditEvent(context.profile, {
    type: "LIBRARY_TASK_CREATE",
    message: `Membuat tugas literasi ${title}.`,
    schoolId: context.schoolId,
    targetId: taskRef.key || undefined,
  });
}

async function toggleTaskStatus(payload: LibraryPayload, authorizationHeader?: string | null) {
  const taskId = normalizeText(payload.taskId);
  if (!taskId) throw new Error("taskId wajib diisi.");

  const taskSnap = await getGasAdminDb().ref(`literacy_tasks/${taskId}`).get();
  if (!taskSnap.exists()) {
    throw new Error("Tugas literasi tidak ditemukan.");
  }
  const task = taskSnap.val() || {};
  const context = await enforceAdminCapability(authorizationHeader, "library.write", {
    requestedSchoolId: normalizeSchoolId(task.schoolId || payload.schoolId),
  });
  if (normalizeSchoolId(task.schoolId) !== context.schoolId) {
    throw new Error("Tugas literasi berasal dari sekolah lain.");
  }

  const nextActive = payload.isActive === true;
  await getGasAdminDb().ref(`literacy_tasks/${taskId}`).update({ isActive: nextActive });

  await writeEduLockAuditEvent(context.profile, {
    type: "LIBRARY_TASK_STATUS_TOGGLE",
    message: `${nextActive ? "Menerbitkan" : "Menarik kembali"} tugas literasi ${taskId}.`,
    schoolId: context.schoolId,
    targetId: taskId,
    metadata: { isActive: nextActive },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LibraryPayload;
    const authorizationHeader = request.headers.get("authorization");

    if (body.action === "borrow-book") {
      await borrowBook(body, authorizationHeader);
      return NextResponse.json({ success: true, message: "Transaksi peminjaman berhasil dibuat." });
    }
    if (body.action === "return-book") {
      await returnBook(body, authorizationHeader);
      return NextResponse.json({ success: true, message: "Pengembalian buku berhasil diproses." });
    }
    if (body.action === "submit-report") {
      await submitReport(body, authorizationHeader);
      return NextResponse.json({ success: true, message: "Laporan literasi berhasil dikirim." });
    }
    if (body.action === "review-report") {
      await reviewReport(body, authorizationHeader);
      return NextResponse.json({ success: true, message: "Laporan literasi berhasil dinilai." });
    }
    if (body.action === "create-task") {
      await createTask(body, authorizationHeader);
      return NextResponse.json({ success: true, message: "Tugas literasi berhasil dibuat." });
    }
    if (body.action === "toggle-task-status") {
      await toggleTaskStatus(body, authorizationHeader);
      return NextResponse.json({ success: true, message: "Status tugas literasi berhasil diubah." });
    }

    return NextResponse.json(
      { success: false, message: "Aksi library admin tidak valid." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: String(error?.message || error) },
      { status: 400 }
    );
  }
}
