import { initializeApp, getApps, getApp } from "firebase/app";
import { forceWebSockets, getDatabase } from "firebase/database";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { FIREBASE_BOUNDARY } from "@/lib/firebaseProjectBoundary";
import { useAuthStore } from "@/store/useAuthStore";

// PortalKita/GAS tetap memakai backend GAS yang terpisah dari EduLock.
// Source of truth boundary disimpan terpusat di firebaseProjectBoundary.ts.
const {
  label: _gasLabel,
  appName: _gasAppName,
  ...firebaseConfig
} = FIREBASE_BOUNDARY.gas;

// Initialize Firebase (Singleton pattern to avoid multiple instances)
function getOrInitDefaultApp() {
  const existing = getApps().find((a) => a.name === '[DEFAULT]');
  if (existing) return existing;
  try {
    return getApp();
  } catch {
    return initializeApp(firebaseConfig);
  }
}
const app = getOrInitDefaultApp();

// Initialize Realtime Database
const database = getDatabase(app);
if (typeof window !== "undefined") {
  forceWebSockets();
}

// Initialize Auth
const auth = getAuth(app);

async function ensureGasAuth(): Promise<void> {
  if (auth.currentUser) {
    await auth.currentUser.getIdToken();
    return;
  }
  if (typeof window !== "undefined") {
    const { isAuthenticated, user } = useAuthStore.getState();
    const isPortalAdmin = isAuthenticated && (user?.role === "admin" || user?.role === "super_admin");
    if (!isPortalAdmin) {
      throw new Error("Sesi admin Portal belum aktif. Login ulang sebelum mengakses database GAS.");
    }
  }
  try {
    const credential = await signInAnonymously(auth);
    await credential.user.getIdToken();
  } catch (e: any) {
    const code = String(e?.code || "");
    if (code === "auth/operation-not-allowed") {
      throw new Error("Auth anonymous belum aktif di Firebase Console (Authentication -> Sign-in method -> Anonymous).");
    }
    throw e;
  }
}

// Initialize Firestore
const db = getFirestore(app);

export { app, database, auth, db, ensureGasAuth };
