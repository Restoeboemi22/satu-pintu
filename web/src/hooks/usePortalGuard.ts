"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, type PortalUserRole } from "@/store/useAuthStore";
import { buildPortalLoginHref, isAllowedRole } from "@/lib/portalAccess";
import { callPortalApi } from "@/lib/callPortalApi";

type GuardStatus = "pending" | "unauthenticated" | "unauthorized" | "allowed";

type UsePortalGuardOptions = {
  allowedRoles: PortalUserRole[];
  returnTo?: string;
  unauthorizedRedirectTo?: string;
  unauthenticatedRedirectTo?: string;
};

export function usePortalGuard({
  allowedRoles,
  returnTo,
  unauthorizedRedirectTo = "/dashboard",
  unauthenticatedRedirectTo,
}: UsePortalGuardOptions) {
  const router = useRouter();
  const { user, isAuthenticated, _hasHydrated, login, clearLocalAuth } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !_hasHydrated) return;

    let cancelled = false;
    void (async () => {
      try {
        const result = await callPortalApi<{ data?: { user?: any } }>("/api/portal/session", "GET");
        const sessionUser = result?.data?.user;
        if (cancelled) return;
        if (sessionUser?.id && sessionUser?.role) {
          login(sessionUser);
        } else if (isAuthenticated) {
          clearLocalAuth();
        }
      } catch {
        if (!cancelled && isAuthenticated) {
          clearLocalAuth();
        }
      } finally {
        if (!cancelled) {
          setSessionChecked(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [_hasHydrated, clearLocalAuth, isAuthenticated, isMounted, login]);

  const status = useMemo<GuardStatus>(() => {
    if (!isMounted || !_hasHydrated || !sessionChecked) return "pending";
    if (!isAuthenticated || !user) return "unauthenticated";
    if (!isAllowedRole(user.role, allowedRoles)) return "unauthorized";
    return "allowed";
  }, [allowedRoles, isAuthenticated, isMounted, sessionChecked, user, _hasHydrated]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(unauthenticatedRedirectTo || buildPortalLoginHref(returnTo));
      return;
    }
    if (status === "unauthorized") {
      router.replace(unauthorizedRedirectTo);
    }
  }, [returnTo, router, status, unauthorizedRedirectTo, unauthenticatedRedirectTo]);

  return {
    user,
    status,
    isReady: status !== "pending",
    isAllowed: status === "allowed",
  };
}
