const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env.local");
const csvPath = path.join(rootDir, "scripts", "data", "admin_bootstrap.generated.csv");
const reportPath = path.join(rootDir, "scripts", "data", "admin_bootstrap.report.json");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeBool(value) {
  const raw = normalizeText(value).toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
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

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result.map((cell) => cell.trim());
}

function parseCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV admin bootstrap kosong atau tidak valid.");
  }

  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    header.forEach((key, index) => {
      row[key] = values[index] || "";
    });
    return row;
  });
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
  if (!fs.existsSync(envPath)) {
    throw new Error(`File .env.local belum ada: ${envPath}`);
  }
  if (!fs.existsSync(csvPath)) {
    throw new Error(`File admin bootstrap belum ada: ${csvPath}`);
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
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const report = [];

  for (const row of rows) {
    const schoolId = normalizeText(row.schoolId);
    const schoolName = normalizeText(row.schoolName);
    const npsn = normalizeText(row.npsn);
    const email = normalizeText(row.systemEmail).toLowerCase();
    const password = normalizeText(row.defaultPassword || "admin123");
    const role = normalizeText(row.role || "admin");
    const isActive = normalizeBool(row.isActive || "true");
    const now = Date.now();

    let userRecord = null;
    let created = false;

    try {
      userRecord = await auth.getUserByEmail(email);
      await auth.updateUser(userRecord.uid, {
        email,
        emailVerified: true,
        password,
        disabled: !isActive,
      });
    } catch (error) {
      if (error && error.code === "auth/user-not-found") {
        userRecord = await auth.createUser({
          email,
          password,
          emailVerified: true,
          disabled: !isActive,
        });
        created = true;
      } else {
        throw error;
      }
    }

    const profileRef = db.ref(`admin_profiles/${userRecord.uid}`);
    const existingProfileSnap = await profileRef.get();
    const existingProfile = existingProfileSnap.exists() ? existingProfileSnap.val() || {} : {};

    await profileRef.set({
      uid: userRecord.uid,
      email,
      role: role === "super_admin" ? "super_admin" : "admin",
      isActive,
      schoolId,
      schoolName,
      npsn,
      mustChangePassword: true,
      passwordChangedAt: null,
      createdAt: typeof existingProfile.createdAt === "number" ? existingProfile.createdAt : now,
      updatedAt: now,
      lastLoginAt: typeof existingProfile.lastLoginAt === "number" ? existingProfile.lastLoginAt : null,
    });

    await db.ref(`schools/${schoolId}`).update({
      updatedAt: now,
      adminAccessActive: isActive,
    });

    report.push({
      schoolId,
      schoolName,
      npsn,
      email,
      uid: userRecord.uid,
      created,
      isActive,
    });

    process.stdout.write(created ? "+" : ".");
  }

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log("\nBootstrap admin EduLock selesai.");
  console.log(`- Total akun: ${report.length}`);
  console.log(`- Laporan   : ${reportPath}`);
}

main().catch((error) => {
  console.error("\n[GAGAL]", error.message || error);
  process.exit(1);
});
