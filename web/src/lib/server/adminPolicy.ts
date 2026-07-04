import {
  requireEduLockAdminProfile,
  type ServerEduLockProfile,
} from "@/lib/server/edulockAuth";

export type AdminCapability =
  | "attendance.settings.write"
  | "attendance.logs.write"
  | "attendance.logs.delete"
  | "virtual-pet.write"
  | "library.write"
  | "seven-habits.write"
  | "principals.write"
  | "super-admin.database.write";

type CapabilityRule = {
  allowedRoles: Array<ServerEduLockProfile["role"]>;
  requiresSchoolScope: boolean;
  allowGlobalForSuperAdmin?: boolean;
  label: string;
};

const CAPABILITY_RULES: Record<AdminCapability, CapabilityRule> = {
  "attendance.settings.write": {
    allowedRoles: ["admin", "super_admin"],
    requiresSchoolScope: true,
    label: "mengubah pengaturan presensi",
  },
  "attendance.logs.write": {
    allowedRoles: ["admin", "super_admin"],
    requiresSchoolScope: true,
    label: "mengubah log presensi",
  },
  "attendance.logs.delete": {
    allowedRoles: ["admin", "super_admin"],
    requiresSchoolScope: true,
    label: "menghapus log presensi",
  },
  "virtual-pet.write": {
    allowedRoles: ["admin", "super_admin"],
    requiresSchoolScope: false,
    label: "mengelola virtual pet",
  },
  "library.write": {
    allowedRoles: ["admin", "super_admin"],
    requiresSchoolScope: true,
    label: "mengelola transaksi Lentera",
  },
  "seven-habits.write": {
    allowedRoles: ["admin", "super_admin"],
    requiresSchoolScope: true,
    label: "mengubah penilaian 7 KAIH",
  },
  "principals.write": {
    allowedRoles: ["super_admin"],
    requiresSchoolScope: false,
    allowGlobalForSuperAdmin: true,
    label: "mengelola akun kepala sekolah",
  },
  "super-admin.database.write": {
    allowedRoles: ["super_admin"],
    requiresSchoolScope: false,
    allowGlobalForSuperAdmin: true,
    label: "mengelola database super admin",
  },
};

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSchoolScope(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

export type AdminPolicyContext = {
  profile: ServerEduLockProfile;
  capability: AdminCapability;
  schoolId: string;
  requestedSchoolId: string;
};

export function resolveSchoolScopeFromProfile(
  profile: ServerEduLockProfile,
  requestedSchoolId?: string,
  options?: { capability?: AdminCapability; allowGlobalForSuperAdmin?: boolean }
) {
  const schoolIdFromPayload = normalizeSchoolScope(requestedSchoolId);
  const allowGlobalForSuperAdmin = options?.allowGlobalForSuperAdmin === true;

  if (profile.role === "admin") {
    const schoolId = normalizeSchoolScope(profile.schoolId);
    if (!schoolId) {
      throw new Error("Akun admin sekolah tidak memiliki schoolId yang valid.");
    }
    if (schoolIdFromPayload && schoolIdFromPayload !== schoolId) {
      throw new Error("Admin sekolah tidak boleh mengakses data sekolah lain.");
    }
    return schoolId;
  }

  if (schoolIdFromPayload) {
    return schoolIdFromPayload;
  }

  if (allowGlobalForSuperAdmin) {
    return "";
  }

  const capabilityLabel = options?.capability
    ? CAPABILITY_RULES[options.capability]?.label || "menjalankan operasi ini"
    : "menjalankan operasi ini";
  throw new Error(`schoolId wajib diisi untuk super admin saat ${capabilityLabel}.`);
}

export async function enforceAdminCapability(
  authorizationHeader: string | null | undefined,
  capability: AdminCapability,
  options?: {
    requestedSchoolId?: string;
    allowGlobalForSuperAdmin?: boolean;
  }
): Promise<AdminPolicyContext> {
  const profile = await requireEduLockAdminProfile(authorizationHeader);
  const rule = CAPABILITY_RULES[capability];

  if (!rule.allowedRoles.includes(profile.role)) {
    throw new Error(`Role ${profile.role} tidak diizinkan untuk ${rule.label}.`);
  }

  const requestedSchoolId = normalizeSchoolScope(options?.requestedSchoolId);
  const schoolId = rule.requiresSchoolScope
    ? resolveSchoolScopeFromProfile(profile, requestedSchoolId, {
        capability,
        allowGlobalForSuperAdmin:
          options?.allowGlobalForSuperAdmin === true || rule.allowGlobalForSuperAdmin === true,
      })
    : resolveSchoolScopeFromProfile(profile, requestedSchoolId, {
        capability,
        allowGlobalForSuperAdmin:
          options?.allowGlobalForSuperAdmin === true || rule.allowGlobalForSuperAdmin === true,
      });

  return {
    profile,
    capability,
    schoolId,
    requestedSchoolId,
  };
}
