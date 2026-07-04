import { cert, getApps, initializeApp, type App, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";
import { FIREBASE_BOUNDARY } from "@/lib/firebaseProjectBoundary";

function requiredServerEnv(name: string): string {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Environment variable server ${name} wajib diisi untuk Firebase Admin.`);
  }
  return value;
}

function parseServiceAccountFromEnv(prefix: "GAS" | "EDULOCK"): ServiceAccount {
  const jsonEnv = String(process.env[`FIREBASE_ADMIN_${prefix}_SERVICE_ACCOUNT_JSON`] || process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON || "").trim();
  if (jsonEnv) {
    const parsed = JSON.parse(jsonEnv) as ServiceAccount;
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  }

  return {
    projectId: requiredServerEnv(`FIREBASE_ADMIN_${prefix}_PROJECT_ID`),
    clientEmail: requiredServerEnv(`FIREBASE_ADMIN_${prefix}_CLIENT_EMAIL`),
    privateKey: requiredServerEnv(`FIREBASE_ADMIN_${prefix}_PRIVATE_KEY`).replace(/\\n/g, "\n"),
  };
}

const gasAdminCredential = cert(parseServiceAccountFromEnv("GAS"));
const edulockAdminCredential = cert(parseServiceAccountFromEnv("EDULOCK"));

function getOrInitAdminApp(name: string, databaseURL: string, credential: ReturnType<typeof cert>): App {
  const existing = getApps().find((app) => app.name === name);
  if (existing) return existing;

  return initializeApp(
    {
      credential,
      databaseURL,
    },
    name
  );
}

export function getGasAdminDb() {
  const app = getOrInitAdminApp("gas-admin", FIREBASE_BOUNDARY.gas.databaseURL, gasAdminCredential);
  return getDatabase(app);
}

export function getGasAdminFirestore() {
  const app = getOrInitAdminApp("gas-admin", FIREBASE_BOUNDARY.gas.databaseURL, gasAdminCredential);
  return getFirestore(app);
}

export function getEduLockAdminDb() {
  const app = getOrInitAdminApp("edulock-admin", FIREBASE_BOUNDARY.edulock.databaseURL, edulockAdminCredential);
  return getDatabase(app);
}

export function getEduLockAdminAuth() {
  const app = getOrInitAdminApp("edulock-admin", FIREBASE_BOUNDARY.edulock.databaseURL, edulockAdminCredential);
  return getAuth(app);
}
