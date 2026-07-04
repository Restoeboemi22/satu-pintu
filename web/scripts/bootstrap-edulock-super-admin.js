const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env.local");

function normalizeText(value) {
  return String(value || "").trim();
}

function parseEnvFile(content) {
  const result = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function getRequiredEnv(env, key) {
  const value = normalizeText(env[key] || process.env[key]);
  if (!value) {
    throw new Error(`Variable ${key} wajib tersedia di .env.local atau environment shell.`);
  }
  return value;
}

function getServiceAccount(env) {
  const rawJson = normalizeText(
    env.FIREBASE_ADMIN_EDULOCK_SERVICE_ACCOUNT_JSON ||
      process.env.FIREBASE_ADMIN_EDULOCK_SERVICE_ACCOUNT_JSON ||
      env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON ||
      process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON
  );

  if (rawJson) {
    const parsed = JSON.parse(rawJson);
    if (parsed.private_key) {
      parsed.private_key = String(parsed.private_key).replace(/\\n/g, "\n");
    }
    return parsed;
  }

  return {
    projectId: getRequiredEnv(env, "FIREBASE_ADMIN_EDULOCK_PROJECT_ID"),
    clientEmail: getRequiredEnv(env, "FIREBASE_ADMIN_EDULOCK_CLIENT_EMAIL"),
    privateKey: getRequiredEnv(env, "FIREBASE_ADMIN_EDULOCK_PRIVATE_KEY").replace(/\\n/g, "\n"),
  };
}

async function main() {
  const email = normalizeText(process.argv[2]).toLowerCase();
  const password = normalizeText(process.argv[3]);
  const displayName = normalizeText(process.argv[4] || "Super Admin");

  if (!email || !email.includes("@")) {
    throw new Error("Email super admin wajib valid.");
  }
  if (password.length < 6) {
    throw new Error("Password super admin minimal 6 karakter.");
  }
  if (!fs.existsSync(envPath)) {
    throw new Error(`File .env.local belum ada: ${envPath}`);
  }

  const env = parseEnvFile(fs.readFileSync(envPath, "utf8"));
  const serviceAccount = getServiceAccount(env);
  const databaseURL = getRequiredEnv(env, "NEXT_PUBLIC_FIREBASE_EDULOCK_DATABASE_URL");

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL,
    });
  }

  const auth = admin.auth();
  const db = admin.database();
  const now = Date.now();

  let userRecord = null;
  let created = false;

  try {
    userRecord = await auth.getUserByEmail(email);
    await auth.updateUser(userRecord.uid, {
      email,
      password,
      displayName,
      emailVerified: true,
      disabled: false,
    });
  } catch (error) {
    if (error && error.code === "auth/user-not-found") {
      userRecord = await auth.createUser({
        email,
        password,
        displayName,
        emailVerified: true,
        disabled: false,
      });
      created = true;
    } else {
      throw error;
    }
  }

  const profileRef = db.ref(`admin_profiles/${userRecord.uid}`);
  const profileSnap = await profileRef.get();
  const existing = profileSnap.exists() ? profileSnap.val() || {} : {};

  await profileRef.set({
    uid: userRecord.uid,
    email,
    role: "super_admin",
    isActive: true,
    schoolId: normalizeText(existing.schoolId),
    schoolName: normalizeText(existing.schoolName) || "PortalKita",
    npsn: normalizeText(existing.npsn),
    mustChangePassword: false,
    passwordChangedAt: typeof existing.passwordChangedAt === "number" ? existing.passwordChangedAt : now,
    createdAt: typeof existing.createdAt === "number" ? existing.createdAt : now,
    updatedAt: now,
    lastLoginAt: typeof existing.lastLoginAt === "number" ? existing.lastLoginAt : null,
    name: displayName,
  });

  console.log("Bootstrap super admin EduLock selesai.");
  console.log(`- Email   : ${email}`);
  console.log(`- UID     : ${userRecord.uid}`);
  console.log(`- Status  : ${created ? "created" : "updated"}`);
  console.log(`- Profile : admin_profiles/${userRecord.uid}`);
}

main().catch((error) => {
  console.error("\n[GAGAL]", error.message || error);
  process.exit(1);
});
