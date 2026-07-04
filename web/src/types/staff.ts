export interface Staff {
  id: string;
  name: string;
  username: string;
  password: string;
  role: "staff";
  isActive: boolean;
  deviceId?: string | null;
  schoolId?: string;
  schoolName?: string;
  npsn?: string;
  createdAt?: number;
  updatedAt?: number;
}
