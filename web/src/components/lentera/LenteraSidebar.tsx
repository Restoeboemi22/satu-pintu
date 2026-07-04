"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BarChart3, BookOpen, FileText, LayoutDashboard, Settings, Users } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { LenteraLogoutButton } from "@/components/lentera/LenteraLogoutButton";

type LenteraNavKey =
  | "dashboard"
  | "loans"
  | "tasks"
  | "members"
  | "stats"
  | "settings";

function getActiveKey(pathname: string | null, tab: string, view: string): LenteraNavKey {
  const safePathname = String(pathname || "");
  if (safePathname.startsWith("/admin/lentera/anggota")) return "members";
  if (safePathname.startsWith("/admin/lentera/pengaturan")) return "settings";
  if (tab === "tasks") return "tasks";
  if (tab === "literacy" && view === "progress") return "stats";
  if (tab === "literacy" && view === "list") return "stats";
  if (tab === "loans") return "loans";
  return "dashboard";
}

export function LenteraSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, _hasHydrated } = useAuthStore();

  const tab = String(searchParams.get("tab") || "").trim();
  const view = String(searchParams.get("view") || "").trim();
  const taskViewRaw = String(searchParams.get("taskView") || "").trim();
  const taskView = taskViewRaw === "needs-grading" || taskViewRaw === "history" ? taskViewRaw : "tasks";
  const activeKey = getActiveKey(pathname, tab, view);

  const linkClass = (key: LenteraNavKey) => {
    const base = "flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-200 rounded-xl";
    const active = key === activeKey;
    return `${base} ${
      active
        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30"
        : "text-slate-300 hover:bg-white/10 hover:text-white"
    }`;
  };

  const taskSubLinkClass = (key: "tasks" | "needs-grading" | "history") => {
    const active = tab === "tasks" && taskView === key;
    return `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
      active
        ? "bg-blue-500/15 text-blue-200 ring-1 ring-blue-400/20"
        : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
    }`;
  };
  const showTaskSubmenu = tab === "tasks";

  if (!String(pathname || "").startsWith("/admin/lentera")) return null;

  return (
    <aside className="hidden w-72 shrink-0 lg:block">
      <div className="flex h-full w-72 flex-col bg-premium text-white print:hidden border-r border-white/10">
        <div className="flex h-28 items-center px-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 ring-1 ring-blue-400/30">
              <BookOpen className="h-6 w-6 text-blue-200" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">Lentera</div>
              <div className="text-xs text-slate-400">Admin Panel</div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-white/5">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Logged in as:</p>
          <p className="font-semibold truncate text-white">{_hasHydrated ? user?.name : ""}</p>
          <p className="text-xs text-blue-300 uppercase font-semibold mt-1">{_hasHydrated ? user?.role : ""}</p>
          {_hasHydrated && user?.schoolName ? (
            <p className="text-xs text-slate-400 mt-1 truncate">{user.schoolName}</p>
          ) : null}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Menu Utama</div>

          <Link href="/admin/lentera" className={linkClass("dashboard")}>
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>

          <Link href="/admin/lentera?tab=loans" className={linkClass("loans")}>
            <BookOpen className="w-4 h-4" />
            <span>Peminjaman</span>
          </Link>

          <Link href="/admin/lentera?tab=tasks" className={linkClass("tasks")}>
            <FileText className="w-4 h-4" />
            <span>Kelola Literasi</span>
          </Link>
          {showTaskSubmenu ? (
            <div className="ml-7 mt-1 space-y-1 border-l border-white/10 pl-3">
              <Link href="/admin/lentera?tab=tasks&taskView=tasks" className={taskSubLinkClass("tasks")}>
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                <span>Daftar Tugas</span>
              </Link>
              <Link href="/admin/lentera?tab=tasks&taskView=needs-grading" className={taskSubLinkClass("needs-grading")}>
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                <span>Perlu Dinilai</span>
              </Link>
              <Link href="/admin/lentera?tab=tasks&taskView=history" className={taskSubLinkClass("history")}>
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                <span>Riwayat</span>
              </Link>
            </div>
          ) : null}

          <Link href="/admin/lentera/anggota" className={linkClass("members")}>
            <Users className="w-4 h-4" />
            <span>Data Anggota</span>
          </Link>

          <Link href="/admin/lentera?tab=literacy&view=progress" className={linkClass("stats")}>
            <BarChart3 className="w-4 h-4" />
            <span>Statistik Siswa</span>
          </Link>

          <div className="h-px bg-white/10 my-4 mx-2"></div>
          <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Lainnya</div>

          <Link href="/admin/lentera/pengaturan" className={linkClass("settings")}>
            <Settings className="w-4 h-4" />
            <span>Pengaturan</span>
          </Link>

          <div className="mt-1">
            <LenteraLogoutButton />
          </div>
        </nav>
      </div>
    </aside>
  );
}
