"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

export function LenteraLogoutButton() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  return (
    <button
      type="button"
      onClick={() => {
        logout();
        router.replace("/admin/login?returnTo=/admin/lentera");
      }}
      className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-all duration-200 text-slate-300 hover:bg-white/10 hover:text-white"
    >
      <LogOut className="h-4 w-4" />
      <span>Logout</span>
    </button>
  );
}
