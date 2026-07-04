import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { forceWebSockets, getDatabase } from "firebase/database";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { FIREBASE_BOUNDARY } from "@/lib/firebaseProjectBoundary";

// EduLock tetap membaca backend EduLock aktif, tetapi akses resminya hanya lewat hosting satu pintu.
// Source of truth boundary disimpan terpusat di firebaseProjectBoundary.ts.
const {
  label: _edulockLabel,
  appName: _ignoredAppName,
  ...edulockFirebaseConfig
} = FIREBASE_BOUNDARY.edulock;

const appName = FIREBASE_BOUNDARY.edulock.appName;

function getOrInitApp(): FirebaseApp {
  const existing = getApps().find((a) => a.name === appName);
  if (existing) return existing;
  try {
    return getApp(appName);
  } catch {
    return initializeApp(edulockFirebaseConfig, appName);
  }
}

export const edulockApp = getOrInitApp();
export const edulockDb = getDatabase(edulockApp);
export const edulockAuth = getAuth(edulockApp);

if (typeof window !== "undefined") {
  forceWebSockets();
  void setPersistence(edulockAuth, browserLocalPersistence).catch(() => {});
}
