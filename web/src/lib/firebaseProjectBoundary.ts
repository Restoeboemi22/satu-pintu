function requiredEnv(value: string | undefined, name: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new Error(`Environment variable ${name} wajib diisi. Instance lokal baru tidak boleh memakai boundary Firebase lama.`);
  }
  return normalized;
}

function optionalEnv(value: string | undefined, fallback = ""): string {
  return String(value || fallback).trim();
}

function csvEnv(value: string | undefined): string[] {
  return optionalEnv(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const FIREBASE_BOUNDARY = {
  hosting: {
    activeHost: requiredEnv(process.env.NEXT_PUBLIC_HOSTING_ACTIVE_HOST, "NEXT_PUBLIC_HOSTING_ACTIVE_HOST"),
    retiredHosts: csvEnv(process.env.NEXT_PUBLIC_HOSTING_RETIRED_HOSTS),
    projectId: requiredEnv(process.env.NEXT_PUBLIC_HOSTING_PROJECT_ID, "NEXT_PUBLIC_HOSTING_PROJECT_ID"),
  },
  gas: {
    label: "GAS / PortalKita",
    appName: "[DEFAULT]",
    apiKey: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_GAS_API_KEY, "NEXT_PUBLIC_FIREBASE_GAS_API_KEY"),
    authDomain: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_GAS_AUTH_DOMAIN, "NEXT_PUBLIC_FIREBASE_GAS_AUTH_DOMAIN"),
    databaseURL: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_GAS_DATABASE_URL, "NEXT_PUBLIC_FIREBASE_GAS_DATABASE_URL"),
    projectId: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_GAS_PROJECT_ID, "NEXT_PUBLIC_FIREBASE_GAS_PROJECT_ID"),
    storageBucket: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_GAS_STORAGE_BUCKET, "NEXT_PUBLIC_FIREBASE_GAS_STORAGE_BUCKET"),
    messagingSenderId: requiredEnv(
      process.env.NEXT_PUBLIC_FIREBASE_GAS_MESSAGING_SENDER_ID,
      "NEXT_PUBLIC_FIREBASE_GAS_MESSAGING_SENDER_ID"
    ),
    appId: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_GAS_APP_ID, "NEXT_PUBLIC_FIREBASE_GAS_APP_ID"),
  },
  edulock: {
    label: "EduLock",
    appName: optionalEnv(process.env.NEXT_PUBLIC_FIREBASE_EDULOCK_APP_NAME, "edulock"),
    apiKey: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_EDULOCK_API_KEY, "NEXT_PUBLIC_FIREBASE_EDULOCK_API_KEY"),
    authDomain: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_EDULOCK_AUTH_DOMAIN, "NEXT_PUBLIC_FIREBASE_EDULOCK_AUTH_DOMAIN"),
    databaseURL: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_EDULOCK_DATABASE_URL, "NEXT_PUBLIC_FIREBASE_EDULOCK_DATABASE_URL"),
    projectId: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_EDULOCK_PROJECT_ID, "NEXT_PUBLIC_FIREBASE_EDULOCK_PROJECT_ID"),
    storageBucket: requiredEnv(process.env.NEXT_PUBLIC_FIREBASE_EDULOCK_STORAGE_BUCKET, "NEXT_PUBLIC_FIREBASE_EDULOCK_STORAGE_BUCKET"),
    messagingSenderId: requiredEnv(
      process.env.NEXT_PUBLIC_FIREBASE_EDULOCK_MESSAGING_SENDER_ID,
      "NEXT_PUBLIC_FIREBASE_EDULOCK_MESSAGING_SENDER_ID"
    ),
    appId: optionalEnv(process.env.NEXT_PUBLIC_FIREBASE_EDULOCK_APP_ID),
  },
} as const;

export type FirebaseBoundaryConfig = typeof FIREBASE_BOUNDARY;

export {};
