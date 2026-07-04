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
  if (!currentUser) {
    throw new Error("Sesi EduLock admin tidak aktif. Silakan login ulang.");
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.success === false) {
    throw new Error(String(result?.message || "Permintaan admin gagal diproses."));
  }

  return result as T;
}
