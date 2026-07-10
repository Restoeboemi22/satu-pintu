import { NextRequest, NextResponse } from "next/server";
import { getGasAdminDb } from "@/lib/server/firebaseAdmin";
import { requireEduLockAdminProfile } from "@/lib/server/edulockAuth";
import { writeEduLockAuditEvent } from "@/lib/server/edulockAudit";

type NotificationTargetType = "TEACHERS" | "STUDENTS" | "CLASS" | "ALL_CLASSES" | "SPECIFIC_STUDENT";
type NotificationChannel = "teacher" | "student";

type NotificationMutationPayload = {
  action?: "create-notification" | "delete-notification" | "clear-history";
  schoolId?: string;
  title?: string;
  message?: string;
  targetType?: NotificationTargetType;
  targetValue?: string;
  targetName?: string;
  senderName?: string;
  id?: string;
  channel?: NotificationChannel;
  items?: Array<{
    id?: string;
    channel?: NotificationChannel;
  }>;
};

const ALLOWED_TARGET_TYPES: NotificationTargetType[] = [
  "TEACHERS",
  "STUDENTS",
  "CLASS",
  "ALL_CLASSES",
  "SPECIFIC_STUDENT",
];

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSchoolScope(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function isAllowedChannel(value: unknown): value is NotificationChannel {
  return value === "teacher" || value === "student";
}

function resolveSchoolId(
  profile: Awaited<ReturnType<typeof requireEduLockAdminProfile>>,
  requestedSchoolId?: string
) {
  if (profile.role === "admin") {
    return normalizeSchoolScope(profile.schoolId);
  }
  return normalizeSchoolScope(requestedSchoolId);
}

function resolveChannel(targetType?: NotificationTargetType): NotificationChannel {
  return targetType === "TEACHERS" ? "teacher" : "student";
}

function getNodePath(channel: NotificationChannel) {
  return channel === "teacher" ? "system_announcements/teacher" : "system_announcements/student";
}

function getScopedNodePath(channel: NotificationChannel, schoolId?: string | null) {
  const normalizedSchoolId = normalizeSchoolScope(schoolId);
  if (!normalizedSchoolId) {
    return null;
  }
  return channel === "teacher"
    ? `system_announcements_by_school/${normalizedSchoolId}/teacher`
    : `system_announcements_by_school/${normalizedSchoolId}/student`;
}

async function createNotification(payload: NotificationMutationPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const targetType = ALLOWED_TARGET_TYPES.includes(payload.targetType as NotificationTargetType)
    ? (payload.targetType as NotificationTargetType)
    : null;
  const title = normalizeText(payload.title);
  const message = normalizeText(payload.message);
  const targetValue = normalizeText(payload.targetValue);
  const targetName = normalizeText(payload.targetName);
  const senderName = normalizeText(payload.senderName) || normalizeText(profile.schoolName || profile.email || "Admin");
  const schoolId = resolveSchoolId(profile, payload.schoolId);

  if (!targetType) {
    throw new Error("Target notifikasi tidak valid.");
  }
  if (!title || !message) {
    throw new Error("Judul dan pesan notifikasi wajib diisi.");
  }
  if (targetType === "CLASS" && !targetValue) {
    throw new Error("Kelas tujuan wajib dipilih.");
  }
  if (targetType === "SPECIFIC_STUDENT" && !targetValue) {
    throw new Error("Siswa tujuan wajib dipilih.");
  }

  const channel = resolveChannel(targetType);
  const nodePath = getNodePath(channel);
  const scopedNodePath = getScopedNodePath(channel, schoolId);
  const now = Date.now();
  const notificationRef = getGasAdminDb().ref(nodePath).push();
  const notificationId = notificationRef.key || String(now);
  const notificationData = {
    title,
    content: message,
    date: now,
    sender: senderName,
    targetType,
    targetValue: targetValue || null,
    targetName: targetName || null,
    schoolId: schoolId || null,
  };

  const updates: Record<string, unknown> = {
    [`${nodePath}/${notificationId}`]: notificationData,
  };
  if (scopedNodePath) {
    updates[`${scopedNodePath}/${notificationId}`] = notificationData;
  }

  await getGasAdminDb().ref().update(updates);

  await writeEduLockAuditEvent(profile, {
    type: "NOTIFICATION_CREATE",
    message: `Broadcast notifikasi ${notificationId} dibuat.`,
    schoolId: schoolId || undefined,
    targetId: notificationId,
    metadata: {
      channel,
      targetType,
      targetValue: targetValue || null,
    },
  });

  return {
    id: notificationId,
    title,
    message,
    targetType,
    targetValue: targetValue || undefined,
    targetName: targetName || undefined,
    sentAt: now,
    senderName,
    schoolId: schoolId || undefined,
    channel,
  };
}

async function deleteNotification(payload: NotificationMutationPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const id = normalizeText(payload.id);
  const channel = payload.channel;
  const schoolId = resolveSchoolId(profile, payload.schoolId);

  if (!id) {
    throw new Error("ID notifikasi tidak valid.");
  }
  if (!isAllowedChannel(channel)) {
    throw new Error("Channel notifikasi tidak valid.");
  }

  const nodePath = getNodePath(channel);
  const notificationRef = getGasAdminDb().ref(`${nodePath}/${id}`);
  const snapshot = await notificationRef.get();
  if (!snapshot.exists()) {
    throw new Error("Notifikasi tidak ditemukan.");
  }

  const current = snapshot.val() || {};
  const recordSchoolId = normalizeSchoolScope(current?.schoolId);
  if (profile.role === "admin" && recordSchoolId !== normalizeSchoolScope(profile.schoolId)) {
    throw new Error("Notifikasi berada di luar tenant admin aktif.");
  }
  if (schoolId && recordSchoolId && recordSchoolId !== schoolId) {
    throw new Error("schoolId notifikasi tidak cocok dengan permintaan.");
  }

  const deletions: Record<string, null> = {
    [`${nodePath}/${id}`]: null,
  };
  const effectiveSchoolId = recordSchoolId || schoolId;
  const effectiveScopedNodePath = getScopedNodePath(channel, effectiveSchoolId);
  if (effectiveScopedNodePath) {
    deletions[`${effectiveScopedNodePath}/${id}`] = null;
  }

  await getGasAdminDb().ref().update(deletions);

  await writeEduLockAuditEvent(profile, {
    type: "NOTIFICATION_DELETE",
    message: `Broadcast notifikasi ${id} dihapus.`,
    schoolId: recordSchoolId || schoolId || undefined,
    targetId: id,
    metadata: {
      channel,
      targetType: normalizeText(current?.targetType) || null,
    },
  });
}

async function clearHistory(payload: NotificationMutationPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const schoolId = resolveSchoolId(profile, payload.schoolId);
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (items.length === 0) {
    throw new Error("Daftar notifikasi yang akan dihapus wajib diisi.");
  }

  let deletedCount = 0;
  for (const item of items) {
    const id = normalizeText(item?.id);
    const channel = item?.channel;
    if (!id || !isAllowedChannel(channel)) continue;

    const nodePath = getNodePath(channel);
    const notificationRef = getGasAdminDb().ref(`${nodePath}/${id}`);
    const snapshot = await notificationRef.get();
    if (!snapshot.exists()) continue;

    const current = snapshot.val() || {};
    const recordSchoolId = normalizeSchoolScope(current?.schoolId);
    if (profile.role === "admin" && recordSchoolId !== normalizeSchoolScope(profile.schoolId)) {
      continue;
    }
    if (schoolId && recordSchoolId && recordSchoolId !== schoolId) {
      continue;
    }

    const deletions: Record<string, null> = {
      [`${nodePath}/${id}`]: null,
    };
    const effectiveSchoolId = recordSchoolId || schoolId;
    const effectiveScopedNodePath = getScopedNodePath(channel, effectiveSchoolId);
    if (effectiveScopedNodePath) {
      deletions[`${effectiveScopedNodePath}/${id}`] = null;
    }

    await getGasAdminDb().ref().update(deletions);
    deletedCount += 1;
  }

  await writeEduLockAuditEvent(profile, {
    type: "NOTIFICATION_CLEAR_HISTORY",
    message: `${deletedCount} notifikasi dihapus dari riwayat.`,
    schoolId: schoolId || undefined,
    metadata: {
      requestedCount: items.length,
      deletedCount,
    },
  });

  return { deletedCount };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as NotificationMutationPayload;
    if (body.action !== "create-notification") {
      return NextResponse.json({ success: false, message: "Aksi notifications admin tidak valid." }, { status: 400 });
    }

    const notification = await createNotification(body, request.headers.get("authorization"));
    return NextResponse.json({ success: true, message: "Notifikasi berhasil dikirim.", data: notification });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as NotificationMutationPayload;
    if (body.action === "delete-notification") {
      await deleteNotification(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Notifikasi berhasil dihapus." });
    }
    if (body.action === "clear-history") {
      const result = await clearHistory(body, request.headers.get("authorization"));
      return NextResponse.json({ success: true, message: "Riwayat notifikasi berhasil dihapus.", data: result });
    }
    return NextResponse.json({ success: false, message: "Aksi notifications admin tidak valid." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}
