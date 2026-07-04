"use client";

import { edulockAuth } from "@/lib/edulockFirebase";

export async function callEduLockSuperApi(
  method: "POST" | "PUT" | "DELETE",
  payload: Record<string, unknown>
) {
  const currentUser = edulockAuth.currentUser;
  if (!currentUser) {
    throw new Error("Sesi EduLock tidak aktif. Silakan login ulang.");
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch("/api/admin/edulock/super", {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.success === false) {
    throw new Error(String(result?.message || "Permintaan super admin EduLock gagal diproses."));
  }

  return result;
}
