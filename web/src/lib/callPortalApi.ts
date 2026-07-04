"use client";

export async function callPortalApi<T = any>(
  path: string,
  method: "GET" | "POST" | "DELETE",
  payload?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    credentials: "include",
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.success === false) {
    throw new Error(String(result?.message || "Permintaan Portal gagal diproses."));
  }

  return result as T;
}
