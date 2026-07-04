"use client";

import { LenteraSidebar } from "@/components/lentera/LenteraSidebar";
import { Suspense, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

export default function LenteraLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, _hasHydrated } = useAuthStore();

  useEffect(() => {
    if (!_hasHydrated) return;

    if (!user) {
      const returnTo = pathname || "/admin/lentera";
      router.replace(`/admin/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    if (user.role !== "admin") {
      router.replace("/admin");
    }
  }, [_hasHydrated, pathname, router, user]);

  if (!_hasHydrated || !user || user.role !== "admin") {
    return <div className="min-h-screen bg-slate-950" />;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="flex min-h-screen">
        <Suspense fallback={<div className="hidden w-72 shrink-0 lg:block" />}>
          <LenteraSidebar />
        </Suspense>
        <main className="min-w-0 flex-1 p-6 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
