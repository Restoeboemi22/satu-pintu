"use client";

import { useEffect } from "react";
import LibraryPage from "@/app/dashboard/library/page";
import { useAuthStore } from "@/store/useAuthStore";
import { useStudentStore } from "@/store/useStudentStore";
import { useClassStore } from "@/store/useClassStore";

export default function AdminLenteraPage() {
  const { user, _hasHydrated } = useAuthStore();
  const { syncStudents } = useStudentStore();
  const { subscribeToClasses } = useClassStore();

  useEffect(() => {
    if (!_hasHydrated || !user) return;

    const unsubStudents = syncStudents();
    const schoolId = String(user.schoolId || "").trim();
    const unsubClasses = schoolId ? subscribeToClasses(schoolId) : () => {};

    return () => {
      try {
        unsubStudents();
      } catch {}
      try {
        unsubClasses();
      } catch {}
    };
  }, [_hasHydrated, subscribeToClasses, syncStudents, user]);

  return <LibraryPage />;
}
