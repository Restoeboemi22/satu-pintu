"use client";

import { edulockAuth } from "@/lib/edulockFirebase";

type AdminHttpMethod = "POST" | "PUT" | "PATCH" | "DELETE";

export function hasEduLockAdminSession() {
  return Boolean(edulockAuth.currentUser);
}

export async function callAdminApi<T = any>(
  path: string,
  method: AdminHttpMethod,
  payload?: Record<string, unknown>
): Promise<T> {
  const currentUser = edulockAuth.currentUser;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (currentUser) {
    const idToken = await currentUser.getIdToken();
    headers.Authorization = `Bearer ${idToken}`;
  }

  const response = await fetch(path, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.success === false) {
    const fallbackMessage = currentUser
      ? "Permintaan admin gagal diproses."
      : "Sesi admin dashboard tidak valid. Silakan login ulang dari halaman admin.";
    throw new Error(String(result?.message || fallbackMessage));
  }

  return result as T;
}
