"use client";

import { useEffect, useState } from "react";

export function PWAUpdateHandler() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [newVersion, setNewVersion] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    let checkingInterval: NodeJS.Timeout;

    const checkForUpdate = async () => {
      try {
        if (!registration) {
          registration = await navigator.serviceWorker.getRegistration();
        }

        if (registration) {
          await registration.update();
        }
      } catch (error) {
        console.log("SW update check failed:", error);
      }
    };

    const onUpdateFound = (reg: ServiceWorkerRegistration) => {
      setNewVersion(new Date().toLocaleTimeString());
      setShowUpdate(true);

      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    };

    const onControllerChange = () => {
      window.location.reload();
    };

    // Check every 5 minutes
    checkingInterval = setInterval(checkForUpdate, 5 * 60 * 1000);

    // Initial check
    checkForUpdate();

    navigator.serviceWorker.ready.then((reg) => {
      registration = reg;
      reg.addEventListener("updatefound", () => onUpdateFound(reg));
    });

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      clearInterval(checkingInterval);
    };
  }, []);

  if (!showUpdate) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-2xl shadow-2xl border border-white/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="font-bold">Update Tersedia!</div>
            <div className="text-sm opacity-90">Aplikasi versi baru siap</div>
          </div>
          <button
            onClick={() => {
              window.location.reload();
            }}
            className="bg-white text-blue-600 px-4 py-2 rounded-xl font-bold hover:bg-blue-50 transition"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}