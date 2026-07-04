import type { PortalUserRole } from "@/store/useAuthStore";

export const DASHBOARD_ROLES: PortalUserRole[] = ["super_admin", "admin"];
export const ADMIN_ROLES: PortalUserRole[] = ["super_admin", "admin"];

export function isAllowedRole(
  role: PortalUserRole | undefined,
  allowedRoles: PortalUserRole[]
): boolean {
  if (!role) return false;
  return allowedRoles.includes(role);
}

export function buildPortalLoginHref(returnTo?: string): string {
  const normalized = normalizeReturnTo(returnTo);
  if (!normalized) return "/admin/login?returnTo=/admin";
  return `/admin/login?returnTo=${encodeURIComponent(normalized)}`;
}

export function normalizeReturnTo(value?: string): string {
  const normalized = String(value || "").trim();
  if (!normalized.startsWith("/")) return "";
  return normalized;
}

export function getPortalRoleLabel(role?: PortalUserRole): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin Sekolah";
    case "teacher":
      return "Guru";
    case "student":
      return "Siswa";
    default:
      return "Pengguna";
  }
}
