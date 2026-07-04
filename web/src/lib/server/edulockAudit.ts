import { getEduLockAdminDb } from "@/lib/server/firebaseAdmin";

type AuditActor = {
  uid?: string;
  email?: string;
  role?: string;
  schoolId?: string;
  schoolName?: string;
};

type AuditPayload = {
  type: string;
  message: string;
  schoolId?: string;
  targetUid?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSchoolId(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function sanitizeMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) continue;
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
      continue;
    }
    out[key] = JSON.stringify(value);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function writeEduLockAuditEvent(actor: AuditActor, payload: AuditPayload) {
  const now = Date.now();
  const eventRef = getEduLockAdminDb().ref("platform_events").push();
  const metadata = sanitizeMetadata(payload.metadata);
  const event: Record<string, unknown> = {
    id: eventRef.key,
    at: now,
    type: normalizeText(payload.type),
    message: normalizeText(payload.message),
    schoolId: normalizeSchoolId(payload.schoolId || actor.schoolId),
    targetUid: normalizeText(payload.targetUid),
    targetId: normalizeText(payload.targetId),
    actorUid: normalizeText(actor.uid),
    actorEmail: normalizeText(actor.email).toLowerCase(),
    actorRole: normalizeText(actor.role),
    actorSchoolId: normalizeSchoolId(actor.schoolId),
    actorSchoolName: normalizeText(actor.schoolName),
  };

  if (metadata) {
    event.metadata = metadata;
  }

  await eventRef.set(event);
}
