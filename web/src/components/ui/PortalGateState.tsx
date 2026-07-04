"use client";

import Link from "next/link";

type PortalGateStateProps = {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
};

export default function PortalGateState({
  title,
  description,
  actionHref,
  actionLabel,
}: PortalGateStateProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" style={{ minHeight: "100vh", backgroundColor: "#020617", color: "#e2e8f0" }}>
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_15%_10%,rgba(99,102,241,0.26),transparent_55%),radial-gradient(900px_circle_at_85%_15%,rgba(34,211,238,0.16),transparent_50%),radial-gradient(800px_circle_at_50%_90%,rgba(168,85,247,0.12),transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-black" />
      </div>
      <div className="mx-auto max-w-xl px-4 py-10">
        <div
          className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur"
          style={{
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.10)",
            backgroundColor: "rgba(15,23,42,0.70)",
            padding: 24,
          }}
        >
          <div className="text-base font-semibold text-slate-100" style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>
            {title}
          </div>
          {description ? (
            <div className="mt-1 text-sm text-slate-300" style={{ marginTop: 6, fontSize: 14, color: "#cbd5e1" }}>
              {description}
            </div>
          ) : null}
          {actionHref && actionLabel ? (
            <div className="mt-4">
              <Link
                href={actionHref}
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#f1f5f9",
                  textDecoration: "none",
                }}
              >
                {actionLabel}
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
