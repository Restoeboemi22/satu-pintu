import { NextRequest, NextResponse } from "next/server";
import { getGasAdminDb } from "@/lib/server/firebaseAdmin";
import { requireEduLockAdminProfile } from "@/lib/server/edulockAuth";
import { writeEduLockAuditEvent } from "@/lib/server/edulockAudit";

type ReportStatus = "PENDING" | "INVESTIGATING" | "RESOLVED" | "CLOSED";

type BullyingReportAdminPayload = {
  action?: "update-status";
  id?: string;
  status?: ReportStatus;
  notes?: string;
};

const ALLOWED_STATUSES: ReportStatus[] = ["PENDING", "INVESTIGATING", "RESOLVED", "CLOSED"];

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSchoolScope(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

async function getStudentIdentitySetBySchoolId(schoolId: string) {
  const snapshot = await getGasAdminDb().ref("master_students").orderByChild("schoolId").equalTo(schoolId).get();
  const identities = new Set<string>();

  if (!snapshot.exists()) return identities;

  Object.entries<any>(snapshot.val() || {}).forEach(([key, value]) => {
    const nisn = normalizeText(value?.nisn || key);
    const id = normalizeText(value?.id);
    if (nisn) identities.add(nisn);
    if (id) identities.add(id);
  });

  return identities;
}

async function updateStatus(payload: BullyingReportAdminPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const id = normalizeText(payload.id);
  const status = ALLOWED_STATUSES.includes(payload.status as ReportStatus)
    ? (payload.status as ReportStatus)
    : null;

  if (!id) {
    throw new Error("ID laporan tidak valid.");
  }
  if (!status) {
    throw new Error("Status laporan tidak valid.");
  }

  const reportRef = getGasAdminDb().ref(`bullying_reports/${id}`);
  const snapshot = await reportRef.get();
  if (!snapshot.exists()) {
    throw new Error("Laporan tidak ditemukan.");
  }

  const current = snapshot.val() || {};
  if (profile.role === "admin") {
    const schoolIdentities = await getStudentIdentitySetBySchoolId(normalizeSchoolScope(profile.schoolId));
    const involvedIds = [
      normalizeText(current?.reporterId),
      normalizeText(current?.victimId),
      normalizeText(current?.perpetratorId),
    ].filter(Boolean);
    const isInsideTenant = involvedIds.some((candidate) => schoolIdentities.has(candidate));
    if (!isInsideTenant) {
      throw new Error("Laporan berada di luar tenant admin aktif.");
    }
  }

  const now = Date.now();
  const notes = normalizeText(payload.notes);
  await reportRef.update({
    status,
    resolutionNotes: notes || null,
    resolvedAt: status === "RESOLVED" || status === "CLOSED" ? now : null,
    updatedAt: now,
  });

  await writeEduLockAuditEvent(profile, {
    type: "BULLYING_REPORT_STATUS_UPDATE",
    message: `Status laporan ${id} diubah menjadi ${status}.`,
    schoolId: profile.schoolId || undefined,
    targetId: id,
    metadata: {
      status,
      category: normalizeText(current?.category) || null,
      notes: notes || null,
    },
  });
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as BullyingReportAdminPayload;
    if (body.action !== "update-status") {
      return NextResponse.json({ success: false, message: "Aksi bullying report admin tidak valid." }, { status: 400 });
    }

    await updateStatus(body, request.headers.get("authorization"));
    return NextResponse.json({ success: true, message: "Status laporan berhasil diperbarui." });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}
