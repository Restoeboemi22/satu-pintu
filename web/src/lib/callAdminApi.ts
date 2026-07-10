"use client";

import { edulockAuth } from "@/lib/edulockFirebase";

type AdminHttpMethod = "POST" | "PUT" | "PATCH" | "DELETE";

function withTimeout<T>(task: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([task, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  }) as Promise<T>;
}

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
  let usingEduLockToken = false;

  if (currentUser) {
    try {
      const idToken = await withTimeout(
        currentUser.getIdToken(),
        2500,
        "Timeout saat mengambil token EduLock."
      );
      headers.Authorization = `Bearer ${idToken}`;
      usingEduLockToken = true;
    } catch (error) {
      console.warn("EduLock token unavailable, falling back to portal session", error);
    }
  }

  const response = await fetch(path, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
    credentials: "include",
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.success === false) {
    const fallbackMessage = usingEduLockToken
      ? "Permintaan admin gagal diproses."
      : "Sesi admin dashboard tidak valid. Silakan login ulang dari halaman admin.";
    throw new Error(String(result?.message || fallbackMessage));
  }

  return result as T;
}
