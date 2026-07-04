"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PortalLoginRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const rawReturnTo = String(searchParams.get("returnTo") || "/admin").trim();
    const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/admin";
    router.replace(`/admin/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, [router, searchParams]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
      <div className="text-gray-500">Mengarahkan...</div>
    </div>
  );
}

export default function PortalLoginPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500">Memuat...</div>
      </div>
    }>
      <PortalLoginRedirect />
    </Suspense>
  );
}

