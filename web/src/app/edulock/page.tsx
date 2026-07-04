"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEduLockAuth } from "@/lib/useEduLockAuth";

export default function EduLockHomePage() {
  const router = useRouter();
  const { role, isLoading } = useEduLockAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!role) return;
    if (role === "super_admin") router.replace("/edulock/super");
    else router.replace("/edulock/admin");
  }, [isLoading, role, router]);

  if (isLoading || role) {
    return (
      <div className="p-6">
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
          <div className="flex flex-col items-center text-center">
            <Image
              src="/Logo EduLock.png"
              alt="EduLock"
              width={420}
              height={186}
              className="h-auto w-full max-w-[420px] object-contain"
              priority
            />
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Mengalihkan ke dashboard EduLock...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/Logo EduLock.png"
            alt="EduLock"
            width={520}
            height={232}
            className="h-auto w-full max-w-[520px] object-contain"
            priority
          />
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Modul EduLock sedang dipindahkan bertahap ke Dashboard Utama.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/edulock/super"
          className="rounded-xl bg-white p-6 shadow-sm border border-gray-200 hover:border-blue-500 transition-colors"
        >
          <div className="text-sm font-semibold text-gray-900">
            Super Admin EduLock
          </div>
          <div className="mt-1 text-sm text-gray-600">
            Pengaturan global, monitoring, keamanan, dan manajemen sekolah.
          </div>
        </Link>

        <Link
          href="/edulock/admin"
          className="rounded-xl bg-white p-6 shadow-sm border border-gray-200 hover:border-blue-500 transition-colors"
        >
          <div className="text-sm font-semibold text-gray-900">
            Admin Sekolah EduLock
          </div>
          <div className="mt-1 text-sm text-gray-600">
            Operasional sekolah: siswa, izin, dan pengelolaan perangkat.
          </div>
        </Link>
      </div>
    </div>
  );
}
