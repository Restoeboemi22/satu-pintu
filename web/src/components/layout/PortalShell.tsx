"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, Menu, Settings } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import Sidebar from "@/components/layout/Sidebar";

type PortalShellProps = {
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  contentContainerClassName?: string;
  mainClassName?: string;
};

export default function PortalShell({
  children,
  backHref = "/admin",
  backLabel = "Kembali ke Dashboard Satu Pintu",
  contentContainerClassName = "mx-auto max-w-7xl",
  mainClassName = "relative z-10 flex-1 overflow-x-hidden overflow-y-auto p-6 print:bg-white print:p-0 print:overflow-visible",
}: PortalShellProps) {
  const { user } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div
      className="flex h-screen"
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
      }}
    >
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/80 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <Sidebar className="hidden md:flex" />

      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
          <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-blue-500 opacity-10 blur-[100px]"></div>
          <div className="absolute bottom-0 right-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-purple-500 opacity-10 blur-[100px]"></div>
        </div>

        <header className="relative z-10 flex h-20 items-center justify-between border-b border-slate-700/50 bg-slate-900/60 px-6 shadow-sm backdrop-blur-2xl">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 md:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href={backHref}
              className="hidden items-center justify-center rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900/60 hover:text-white sm:inline-flex"
            >
              {backLabel}
            </Link>
            <button type="button" className="relative rounded-xl p-2.5 transition-colors hover:bg-slate-800">
              <Bell className="h-5 w-5 text-slate-400" />
              <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-red-500"></span>
            </button>
            <button type="button" className="rounded-xl p-2.5 transition-colors hover:bg-slate-800">
              <Settings className="h-5 w-5 text-slate-400" />
            </button>
            <div className="flex items-center gap-3 border-l border-slate-700 pl-4">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold text-slate-200">{user?.name}</p>
                <p className="text-xs capitalize text-slate-500">
                  {user?.role === "super_admin"
                    ? "Super Admin"
                    : user?.role === "admin"
                      ? "Admin Sekolah"
                      : user?.role === "teacher"
                        ? "Guru"
                        : "Siswa"}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 font-bold text-white shadow-lg shadow-blue-500/30">
                {user?.name?.charAt(0) || "P"}
              </div>
            </div>
          </div>
        </header>

        <main className={mainClassName}>
          <div className={contentContainerClassName}>{children}</div>
        </main>
      </div>
    </div>
  );
}
