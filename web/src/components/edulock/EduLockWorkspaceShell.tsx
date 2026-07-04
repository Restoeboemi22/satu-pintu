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
    <PortalShell backHref="/admin">
      <div className="space-y-6 text-slate-100">
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold tracking-widest text-slate-400">PORTALKITA / EDULOCK</div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">{subtitle}</p>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100">
              {badge}
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-6 xl:flex-row">
          <aside className="w-full shrink-0 xl:w-80">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl backdrop-blur">
              <div className="border-b border-white/10 p-5">
                <div className="text-xs font-semibold tracking-widest text-slate-400">SUB MENU</div>
                <div className="mt-2 text-lg font-bold text-white">{panelTitle}</div>
                <p className="mt-2 text-sm text-slate-300">{panelDescription}</p>
              </div>
              <div className="space-y-5 p-4">
                {navGroups.map((group) => (
                  <div key={group.label}>
                    <div className="px-2 text-xs font-semibold tracking-widest text-slate-500">{group.label}</div>
                    <div className="mt-2 space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeKey === item.key;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => onSelect(item.key)}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                              isActive
                                ? "bg-gradient-to-r from-cyan-600/80 to-blue-600/80 text-white shadow-lg shadow-cyan-900/25"
                                : "text-slate-200 hover:bg-white/5"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="min-w-0 flex-1 space-y-6">
            {actions}
            {children}
          </section>
        </div>
      </div>
    </PortalShell>
  );
}
