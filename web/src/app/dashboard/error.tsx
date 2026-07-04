"use client";

import { useEffect } from "react";
import PortalGateState from "@/components/ui/PortalGateState";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error("Dashboard route error:", error);
  }, [error]);

  return (
    <div>
      <PortalGateState
        title="Terjadi gangguan pada dashboard."
        description="Silakan coba muat ulang area dashboard. Jika masalah berulang, cek log dan store terkait."
      />
      <div className="-mt-24 flex justify-center px-4 pb-10">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/15"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
