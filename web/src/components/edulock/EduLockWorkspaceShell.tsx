"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import PortalShell from "@/components/layout/PortalShell";

export type EduLockNavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
};

export type EduLockNavGroup = {
  label: string;
  items: EduLockNavItem[];
};

type EduLockWorkspaceShellProps = {
  title: string;
  subtitle: string;
  badge: string;
  panelTitle: string;
  panelDescription: string;
  navGroups: EduLockNavGroup[];
  activeKey: string;
  onSelect: (key: string) => void;
  actions?: ReactNode;
  children: ReactNode;
};

export default function EduLockWorkspaceShell({
  title,
  subtitle,
  badge,
  panelTitle,
  panelDescription,
  navGroups,
  activeKey,
  onSelect,
  actions,
  children,
}: EduLockWorkspaceShellProps) {
  return (
    <PortalShell backHref="/admin" backLabel="Kembali ke PortalKita">
      <div className="space-y-6 text-slate-100">
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold tracking-widest text-slate-400">PORTALKITA / EDULOCK</div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">{subtitle}</p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs font-semibold tracking-widest text-slate-400">SUB MENU</div>
                <div className="mt-1 text-sm font-semibold text-white">{panelTitle}</div>
                <p className="mt-1 text-xs text-slate-300">{panelDescription}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100">
              {badge}
            </div>
          </div>
        </section>

        <section className="min-w-0 space-y-6">
          {actions}
          {children}
        </section>
      </div>
    </PortalShell>
  );
}
