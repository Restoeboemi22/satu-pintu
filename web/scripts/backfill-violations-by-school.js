const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  if (!hit) return fallback;
  return String(hit.slice(prefix.length)).trim();
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function normalizeSchoolId(value) {
  return String(value || "").trim().toLowerCase();
}

function loadJson(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`File tidak ditemukan: ${abs}`);
  }
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function chunkEntries(entries, size) {
  const chunks = [];
  for (let i = 0; i < entries.length; i += size) {
    chunks.push(entries.slice(i, i + size));
  }
  return chunks;
}

function printUsage() {
  console.log(`
Backfill violations_by_school dari node violations

Contoh:
node scripts/backfill-violations-by-school.js --dry-run
node scripts/backfill-violations-by-school.js --only-school=smpn3pacet

Argumen opsional:
  --service-account   path service account JSON
  --db-url            RTDB URL
  --only-school       batasi hanya 1 schoolId
  --dry-run           hitung saja tanpa menulis
`);
}

async function initAdminApp(serviceAccountPath, databaseURL) {
  const serviceAccount = loadJson(serviceAccountPath);
  try {
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
      databaseURL,
    });
  } catch (_error) {
    return admin.app();
  }
}

async function main() {
  if (hasFlag("help")) {
    printUsage();
    return;
  }

  const serviceAccountPath = readArg("service-account", path.resolve(__dirname, "../service-account.json"));
  const databaseURL = readArg("db-url", "https://edulock-4b7fc-default-rtdb.asia-southeast1.firebasedatabase.app");
  const onlySchool = normalizeSchoolId(readArg("only-school"));
  const dryRun = hasFlag("dry-run");

  console.log("=== BACKFILL VIOLATIONS BY SCHOOL ===");
  console.log(`DB URL        : ${databaseURL}`);
  console.log(`Service       : ${serviceAccountPath}`);
  console.log(`Mode          : ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Filter School : ${onlySchool || "(semua)"}`);

  const app = await initAdminApp(serviceAccountPath, databaseURL);
  const db = admin.database(app);

  const [violationsSnap, studentsSnap] = await Promise.all([
    db.ref("violations").get(),
    db.ref("students").get(),
  ]);

  const violations = violationsSnap.exists() ? violationsSnap.val() : {};
  const students = studentsSnap.exists() ? studentsSnap.val() : {};

  const schoolIdByNisn = new Map();
  if (students && typeof students === "object") {
    Object.entries(students).forEach(([nisn, value]) => {
      const schoolId = normalizeSchoolId(value && typeof value === "object" ? value.schoolId : "");
      if (schoolId) schoolIdByNisn.set(String(nisn || "").trim(), schoolId);
    });
  }

  const updates = {};
  const unresolved = [];
  let totalViolations = 0;
  let linkedViolations = 0;
  let updatedRootSchoolId = 0;

  if (violations && typeof violations === "object") {
    Object.entries(violations).forEach(([violationId, value]) => {
      totalViolations += 1;
      const row = value && typeof value === "object" ? value : {};
      const nisn = String(row.nisn || "").trim();
      const schoolId = normalizeSchoolId(row.schoolId || schoolIdByNisn.get(nisn));

      if (!schoolId) {
        unresolved.push({ violationId, nisn, type: row.type || "" });
        return;
      }

      if (onlySchool && schoolId !== onlySchool) return;

      const nextRow = {
        ...row,
        schoolId,
      };

      updates[`violations_by_school/${schoolId}/${violationId}`] = nextRow;
      linkedViolations += 1;

      if (!normalizeSchoolId(row.schoolId)) {
        updates[`violations/${violationId}/schoolId`] = schoolId;
        updatedRootSchoolId += 1;
      }
    });
  }

  console.log(`Total violations : ${totalViolations}`);
  console.log(`Tertaut sekolah  : ${linkedViolations}`);
  console.log(`Update root sid  : ${updatedRootSchoolId}`);
  console.log(`Tidak terpetakan : ${unresolved.length}`);

  if (unresolved.length > 0) {
    console.log("Contoh unresolved:");
    unresolved.slice(0, 20).forEach((item) => {
      console.log(`- ${item.violationId} | nisn=${item.nisn || "-"} | type=${item.type || "-"}`);
    });
  }

  if (dryRun) {
    console.log("DRY RUN selesai. Tidak ada data yang ditulis.");
    return;
  }

  const entries = Object.entries(updates);
  if (entries.length === 0) {
    console.log("Tidak ada update yang perlu ditulis.");
    return;
  }

  const chunks = chunkEntries(entries, 500);
  console.log(`Batch write     : ${chunks.length} batch`);

  for (let index = 0; index < chunks.length; index += 1) {
    const batchObject = Object.fromEntries(chunks[index]);
    await db.ref().update(batchObject);
    console.log(`Batch ${index + 1}/${chunks.length} selesai`);
  }

  console.log("Backfill selesai.");
}

main().catch((error) => {
  console.error("[FATAL]", error?.message || error);
  process.exit(1);
});
