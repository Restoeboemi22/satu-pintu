import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export type PortalSessionRole = "super_admin" | "admin" | "teacher" | "student";

export type PortalSessionUser = {
  id: string;
  name: string;
  email: string;
  role: PortalSessionRole;
  schoolId?: string;
  schoolName?: string;
  npsn?: string;
  class?: string;
  nisn?: string;
  nuptk?: string;
};

type PortalSessionPayload = {
  user: PortalSessionUser;
  issuedAt: number;
  expiresAt: number;
};

export const PORTAL_SESSION_COOKIE = "portal_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function resolveSessionSecret() {
  const secret =
    process.env.PORTAL_SESSION_SECRET ||
    process.env.FIREBASE_ADMIN_GAS_PRIVATE_KEY ||
    process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!String(secret || "").trim()) {
    throw new Error("Secret sesi portal belum dikonfigurasi.");
  }

  return String(secret);
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", resolveSessionSecret()).update(value).digest("base64url");
}

function buildToken(payload: PortalSessionPayload) {
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

function verifyToken(token: string): PortalSessionPayload | null {
  const [encoded, signature] = String(token || "").split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(encoded)) as PortalSessionPayload;
    if (!parsed?.user?.id || !parsed?.user?.role) return null;
    if (!Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildPortalSessionUser(input: PortalSessionUser): PortalSessionUser {
  const user = {
    id: String(input.id || "").trim(),
    name: String(input.name || "").trim(),
    email: String(input.email || "").trim(),
    role: input.role,
    schoolId: String(input.schoolId || "").trim() || undefined,
    schoolName: String(input.schoolName || "").trim() || undefined,
    npsn: String(input.npsn || "").trim() || undefined,
    class: String(input.class || "").trim() || undefined,
    nisn: String(input.nisn || "").trim() || undefined,
    nuptk: String(input.nuptk || "").trim() || undefined,
  };

  if (!user.id || !user.role) {
    throw new Error("Payload sesi portal tidak valid.");
  }
  if (user.role !== "super_admin" && !user.schoolId) {
    throw new Error(`Role ${user.role} wajib memiliki schoolId pada sesi portal.`);
  }

  return user;
}

export function createPortalSessionToken(user: PortalSessionUser) {
  const now = Date.now();
  return buildToken({
    user: buildPortalSessionUser(user),
    issuedAt: now,
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
  });
}

export function readPortalSessionFromToken(token: string | undefined | null) {
  return verifyToken(String(token || ""));
}

export function getPortalSessionFromRequest() {
  const token = cookies().get(PORTAL_SESSION_COOKIE)?.value;
  return readPortalSessionFromToken(token);
}

export function requirePortalSession(allowedRoles?: PortalSessionRole[]) {
  const session = getPortalSessionFromRequest();
  if (!session) {
    throw new Error("Sesi Portal tidak aktif. Silakan login ulang.");
  }

  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    throw new Error(`Role ${session.user.role} tidak diizinkan untuk operasi ini.`);
  }

  return session;
}

export function buildPortalSessionCookie(token: string) {
  return {
    name: PORTAL_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function buildClearPortalSessionCookie() {
  return {
    name: PORTAL_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}
