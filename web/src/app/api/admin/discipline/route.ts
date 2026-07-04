import { NextRequest, NextResponse } from "next/server";
import { getGasAdminDb } from "@/lib/server/firebaseAdmin";
import { requireEduLockAdminProfile } from "@/lib/server/edulockAuth";
import { writeEduLockAuditEvent } from "@/lib/server/edulockAudit";

type RuleCategory = "VIOLATION" | "ACHIEVEMENT";
type RuleSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type DisciplineRulePayload = {
  id?: number;
  ruleName?: string;
  category?: RuleCategory;
  points?: number;
  severity?: RuleSeverity;
  description?: string | null;
  isActive?: boolean;
  createdAt?: number;
  updatedAt?: number;
};

type DisciplineAdminPayload = {
  action?: "save-rules" | "reset-rules";
  schoolId?: string;
  rules?: DisciplineRulePayload[];
};

const DISCIPLINE_RULES_BY_SCHOOL_ROOT = "discipline_rules_by_school";
const ALLOWED_CATEGORIES: RuleCategory[] = ["VIOLATION", "ACHIEVEMENT"];
const ALLOWED_SEVERITIES: RuleSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSchoolScope(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function resolveSchoolId(
  profile: Awaited<ReturnType<typeof requireEduLockAdminProfile>>,
  requestedSchoolId?: string
) {
  if (profile.role === "admin") {
    return normalizeSchoolScope(profile.schoolId);
  }

  const schoolId = normalizeSchoolScope(requestedSchoolId);
  if (!schoolId) {
    throw new Error("schoolId wajib diisi untuk operasi super admin.");
  }
  return schoolId;
}

function sanitizeRules(rules: DisciplineRulePayload[]) {
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new Error("Daftar aturan wajib diisi.");
  }

  const seenIds = new Set<number>();
  const sanitized = rules.map((rule) => {
    const id = Number(rule?.id);
    const ruleName = normalizeText(rule?.ruleName);
    const category = ALLOWED_CATEGORIES.includes(rule?.category as RuleCategory)
      ? (rule?.category as RuleCategory)
      : "VIOLATION";
    const severity = ALLOWED_SEVERITIES.includes(rule?.severity as RuleSeverity)
      ? (rule?.severity as RuleSeverity)
      : "LOW";
    const points = Number(rule?.points);
    const createdAt = Number(rule?.createdAt);
    const updatedAt = Number(rule?.updatedAt);

    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("ID rule tidak valid.");
    }
    if (seenIds.has(id)) {
      throw new Error("ID rule duplikat terdeteksi.");
    }
    if (!ruleName) {
      throw new Error("Nama rule wajib diisi.");
    }
    if (!Number.isFinite(points) || points < 0) {
      throw new Error(`Poin untuk rule ${ruleName} tidak valid.`);
    }

    seenIds.add(id);

    return {
      id,
      ruleName,
      category,
      points,
      severity,
      description: normalizeText(rule?.description) || null,
      isActive: rule?.isActive !== false,
      createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now(),
      updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now(),
    };
  });

  return sanitized;
}

async function saveRules(payload: DisciplineAdminPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const schoolId = resolveSchoolId(profile, payload.schoolId);
  const sanitizedRules = sanitizeRules(Array.isArray(payload.rules) ? payload.rules : []);
  const rulesMap = sanitizedRules.reduce<Record<string, typeof sanitizedRules[number]>>((acc, rule) => {
    acc[String(rule.id)] = rule;
    return acc;
  }, {});

  await getGasAdminDb().ref(`${DISCIPLINE_RULES_BY_SCHOOL_ROOT}/${schoolId}`).set(rulesMap);

  await writeEduLockAuditEvent(profile, {
    type: "DISCIPLINE_RULES_SAVE",
    message: `Aturan kedisiplinan sekolah ${schoolId} diperbarui.`,
    schoolId,
    metadata: {
      count: sanitizedRules.length,
      violationCount: sanitizedRules.filter((rule) => rule.category === "VIOLATION").length,
      achievementCount: sanitizedRules.filter((rule) => rule.category === "ACHIEVEMENT").length,
    },
  });
}

async function resetRules(payload: DisciplineAdminPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const schoolId = resolveSchoolId(profile, payload.schoolId);

  await getGasAdminDb().ref(`${DISCIPLINE_RULES_BY_SCHOOL_ROOT}/${schoolId}`).remove();

  await writeEduLockAuditEvent(profile, {
    type: "DISCIPLINE_RULES_RESET",
    message: `Aturan kedisiplinan sekolah ${schoolId} dikembalikan ke default.`,
    schoolId,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DisciplineAdminPayload;
    if (body.action !== "save-rules") {
      return NextResponse.json({ success: false, message: "Aksi discipline admin tidak valid." }, { status: 400 });
    }

    await saveRules(body, request.headers.get("authorization"));
    return NextResponse.json({ success: true, message: "Aturan kedisiplinan berhasil disimpan." });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as DisciplineAdminPayload;
    if (body.action !== "reset-rules") {
      return NextResponse.json({ success: false, message: "Aksi discipline admin tidak valid." }, { status: 400 });
    }

    await resetRules(body, request.headers.get("authorization"));
    return NextResponse.json({ success: true, message: "Aturan kedisiplinan berhasil dikembalikan ke default." });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}
