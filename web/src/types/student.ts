export interface Student {
  id: string;
  nisn: string;
  name: string;
  class?: string; // e.g., "VII-A", "VIII-B"
  schoolId?: string;
  schoolName?: string;
  npsn?: string;
  gender?: "L" | "P";
  religion?: "ISLAM" | "NON_ISLAM";
  birthPlace?: string;
  birthDate?: string; // ISO date string YYYY-MM-DD
  address?: string;
  parentName?: string;
  phone?: string;
  status?: "active" | "inactive" | "graduated" | "transferred";
  email?: string;
  avatar?: string;
  deviceId?: string | null; // For 1 device 1 login policy
  lastLogin?: string | null; // ISO date string
  username?: string;
  password?: string;
  isOnline?: boolean;
  deviceStatus?: string;
  connectionStatus?: string;
}
