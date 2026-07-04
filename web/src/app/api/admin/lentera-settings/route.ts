import { NextRequest, NextResponse } from "next/server";
import { getGasAdminDb } from "@/lib/server/firebaseAdmin";
import { requireEduLockAdminProfile } from "@/lib/server/edulockAuth";
import { writeEduLockAuditEvent } from "@/lib/server/edulockAudit";

type SchoolIdentity = {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
};

type AcademicYear = {
  id?: string;
  name?: string;
  semester?: "Ganjil" | "Genap";
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
};

type TaskDefaults = {
  defaultPoints?: number;
  defaultDurationMinutes?: number;
  autoPublish?: boolean;
  reminderDays?: number;
};

type LoanSettings = {
  defaultLoanDays?: number;
  maxActiveLoans?: number;
  finePerDay?: number;
  allowWeekendDueDate?: boolean;
};

type LenteraSettingsMutationPayload = {
  action?: "save-settings";
  schoolId?: string;
  schoolIdentity?: SchoolIdentity;
  academicYears?: AcademicYear[];
  activeYearId?: string | null;
  taskDefaults?: TaskDefaults;
  loanSettings?: LoanSettings;
};

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

async function saveSettings(payload: LenteraSettingsMutationPayload, authorizationHeader?: string | null) {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const schoolId = profile.role === "admin"
    ? normalizeText(profile.schoolId).toLowerCase()
    : normalizeText(payload.schoolId).toLowerCase();

  if (!schoolId) {
    throw new Error("schoolId Lentera tidak tersedia.");
  }

  const schoolIdentity = {
    name: normalizeText(payload.schoolIdentity?.name) || "Lentera Digital",
    address: normalizeText(payload.schoolIdentity?.address),
    email: normalizeText(payload.schoolIdentity?.email),
    phone: normalizeText(payload.schoolIdentity?.phone),
    website: normalizeText(payload.schoolIdentity?.website),
    logoUrl: normalizeText(payload.schoolIdentity?.logoUrl),
  };

  const academicYears = Array.isArray(payload.academicYears)
    ? payload.academicYears.map((year) => ({
        id: normalizeText(year?.id),
        name: normalizeText(year?.name),
        semester: year?.semester === "Genap" ? "Genap" : "Ganjil",
        isActive: Boolean(year?.isActive),
        startDate: normalizeText(year?.startDate),
        endDate: normalizeText(year?.endDate),
      }))
    : [];

  const activeYearId = normalizeText(payload.activeYearId);
  const taskDefaults = {
    defaultPoints: Number(payload.taskDefaults?.defaultPoints ?? 30),
    defaultDurationMinutes: Number(payload.taskDefaults?.defaultDurationMinutes ?? 45),
    autoPublish: payload.taskDefaults?.autoPublish === true,
    reminderDays: Number(payload.taskDefaults?.reminderDays ?? 3),
  };
  const loanSettings = {
    defaultLoanDays: Number(payload.loanSettings?.defaultLoanDays ?? 7),
    maxActiveLoans: Number(payload.loanSettings?.maxActiveLoans ?? 2),
    finePerDay: Number(payload.loanSettings?.finePerDay ?? 1000),
    allowWeekendDueDate: payload.loanSettings?.allowWeekendDueDate === true,
  };

  await getGasAdminDb().ref(`lentera_settings/${schoolId}`).set({
    schoolIdentity,
    academicYears,
    activeYearId: activeYearId || null,
    taskDefaults,
    loanSettings,
    updatedAt: Date.now(),
  });

  await writeEduLockAuditEvent(profile, {
    type: "LENTERA_SETTINGS_SAVE",
    message: `Pengaturan Lentera sekolah ${schoolId} diperbarui.`,
    schoolId,
    metadata: {
      academicYearCount: academicYears.length,
      activeYearId: activeYearId || null,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LenteraSettingsMutationPayload;
    if (body.action !== "save-settings") {
      return NextResponse.json({ success: false, message: "Aksi pengaturan Lentera tidak valid." }, { status: 400 });
    }

    await saveSettings(body, request.headers.get("authorization"));
    return NextResponse.json({ success: true, message: "Pengaturan Lentera berhasil disimpan." });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: String(error?.message || error) }, { status: 400 });
  }
}
