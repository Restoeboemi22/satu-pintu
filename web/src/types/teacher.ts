export interface Teacher {
  id: string;
  nuptk: string; // Used as Password
  name: string; // Used as Username
  homeroomClass?: string; // e.g., "VII-A", "VIII-B" or undefined/null
  phone: string;
  email?: string;
  status: "active" | "inactive";
  deviceId?: string | null;
  schoolId?: string;
  schoolName?: string;
  npsn?: string;
  createdAt?: number;
  updatedAt?: number;
}
