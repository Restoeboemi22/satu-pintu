"use client";

import { useEffect } from "react";

const CLEANUP_FLAG = "spentgapa-sw-cleanup-v1";

export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let isMounted = true;

    const cleanup = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (!isMounted || registrations.length === 0) return;

        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ("caches" in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map((key) => caches.delete(key)));
        }

        if (sessionStorage.getItem(CLEANUP_FLAG) !== "done") {
          sessionStorage.setItem(CLEANUP_FLAG, "done");
          window.location.reload();
        }
      } catch (error) {
        console.error("Failed to clean service workers", error);
      }
    };

    cleanup();

    return () => {
      isMounted = false;
    };
  }, []);

  return null;
}
