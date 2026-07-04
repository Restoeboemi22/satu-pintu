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

function loadJson(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`File tidak ditemukan: ${abs}`);
  }
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeScope(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeClassName(value) {
  const base = String(value || "")
    .toUpperCase()
    .replace(/KELAS|CLASS/g, "")
    .trim();
  if (!base) return "";
  const match = base.match(/^(VIII|VII|IX|7|8|9)(?:\s*[-.]?\s*)?(.*)$/);
  if (!match) return base;
  let grade = String(match[1] || "").trim().toUpperCase();
  if (grade === "7") grade = "VII";
  if (grade === "8") grade = "VIII";
  if (grade === "9") grade = "IX";
  const suffix = String(match[2] || "").trim().replace(/^\-+/, "");
  return suffix ? `${grade}-${suffix}` : grade;
}

function printUsage() {
  console.log(`
Migrasi ringan literacy_logs orphan

Contoh dry run:
node scripts/migrate-literacy-orphan-logs.js ^
  --service-account=./service-account.json ^
  --db-url=https://smpn3pacet-app-default-rtdb.asia-southeast1.firebasedatabase.app ^
  --school-id=smpn_3_pacet

Contoh apply:
node scripts/migrate-literacy-orphan-logs.js ^
  --service-account=./service-account.json ^
  --db-url=https://smpn3pacet-app-default-rtdb.asia-southeast1.firebasedatabase.app ^
  --school-id=smpn_3_pacet ^
  --apply

Argumen:
  --service-account   file service account Firebase Admin
  --db-url            URL RTDB target
  --school-id         filter scope sekolah, opsional
  --log-ids           daftar id log dipisah koma, opsional
  --apply             jalankan penulisan live, default dry run
`);
}

function addToIndex(map, key, value) {
  if (!key) return;
  const list = map.get(key) || [];
  list.push(value);
  map.set(key, list);
}

function uniqueMatch(list) {
  return Array.isArray(list) && list.length === 1 ? list[0] : null;
}

function buildStudentIndexes(studentMap, schoolScopeFilter) {
  const byId = new Map();
  const byName = new Map();
  const byNameClass = new Map();

  for (const [key, raw] of Object.entries(studentMap || {})) {
    const student = raw || {};
    const schoolId = normalizeScope(student.schoolId);
    if (schoolScopeFilter && schoolId !== schoolScopeFilter) continue;

    const nisn = String(student.nisn || key || "").trim();
    const id = String(student.id || "").trim();
    const name = normalizeText(student.name || student.nama);
    const className = normalizeClassName(student.class || student.kelas || student.className);

    const normalizedStudent = {
      key,
      nisn,
      id,
      name: String(student.name || student.nama || "").trim(),
      nameKey: name,
      className,
      schoolId,
    };

    if (nisn) byId.set(nisn, normalizedStudent);
    if (id) byId.set(id, normalizedStudent);
    addToIndex(byName, name, normalizedStudent);
    addToIndex(byNameClass, `${name}|${className}`, normalizedStudent);
  }

  return { byId, byName, byNameClass };
}

function findMatchForLog(log, indexes, schoolScopeFilter) {
  const studentIdCandidates = [
    log.studentId,
    log.nisn,
    log.studentNisn,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  for (const candidate of studentIdCandidates) {
    const matched = indexes.byId.get(candidate);
    if (!matched) continue;
    if (schoolScopeFilter && matched.schoolId !== schoolScopeFilter) continue;
    return { student: matched, reason: "studentId/NISN cocok" };
  }

  const nameKey = normalizeText(
    log.studentName ||
      log.name ||
      log.displayName ||
      log.sender ||
      log.userName
  );
  const className = normalizeClassName(log.studentClass || log.class || log.kelas);

  if (!nameKey) return null;

  if (className) {
    const matched = uniqueMatch(indexes.byNameClass.get(`${nameKey}|${className}`));
    if (matched) {
      return { student: matched, reason: "nama + kelas unik" };
    }
  }

  const matchedByName = uniqueMatch(indexes.byName.get(nameKey));
  if (matchedByName) {
    return { student: matchedByName, reason: "nama unik" };
  }

  return null;
}

async function initAdminApp(serviceAccountPath, databaseURL) {
  const serviceAccount = loadJson(serviceAccountPath);
  try {
    return admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
        databaseURL,
      },
      "literacy-orphan-migration"
    );
  } catch (error) {
    return admin.app("literacy-orphan-migration");
  }
}

async function main() {
  const serviceAccountPath = readArg("service-account");
  const dbUrl = readArg("db-url");
  const schoolScopeFilter = normalizeScope(readArg("school-id"));
  const logIds = readArg("log-ids")
    .split(",")
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const apply = hasFlag("apply");

  if (!serviceAccountPath || !dbUrl) {
    printUsage();
    process.exit(1);
  }

  console.log("=== MIGRASI LITERACY LOGS ORPHAN ===");
  console.log(`Mode       : ${apply ? "LIVE" : "DRY RUN"}`);
  console.log(`DB URL     : ${dbUrl}`);
  console.log(`School ID  : ${schoolScopeFilter || "(semua sekolah)"}`);
  console.log(`Log Filter : ${logIds.length > 0 ? logIds.join(", ") : "(semua log)"}`);

  const app = await initAdminApp(serviceAccountPath, dbUrl);
  const db = admin.database(app);

  const [studentsSnap, logsSnap] = await Promise.all([
    db.ref("master_students").get(),
    db.ref("literacy_logs").get(),
  ]);

  const studentMap = studentsSnap.exists() ? studentsSnap.val() : {};
  const logsMap = logsSnap.exists() ? logsSnap.val() : {};
  const indexes = buildStudentIndexes(studentMap, schoolScopeFilter);

  const updates = {};
  const patchable = [];
  const skipped = [];

  for (const [logId, rawLog] of Object.entries(logsMap || {})) {
    if (logIds.length > 0 && !logIds.includes(logId)) continue;

    const log = rawLog || {};
    const currentStudentId = String(log.studentId || log.nisn || log.studentNisn || "").trim();
    const currentSchoolId = normalizeScope(log.schoolId);
    const currentClass = normalizeClassName(log.studentClass || log.class || log.kelas);

    const isOrphan = !currentStudentId || !currentSchoolId || !currentClass;
    if (!isOrphan) continue;

    const matched = findMatchForLog(log, indexes, schoolScopeFilter);
    if (!matched) {
      skipped.push({
        logId,
        reason: "identitas tidak cukup pasti",
        currentStudentId,
        currentSchoolId,
      });
      continue;
    }

    const nextStudentId = matched.student.nisn || matched.student.id;
    const nextSchoolId = matched.student.schoolId;
    const nextClass = matched.student.className;

    if (!nextStudentId || !nextSchoolId) {
      skipped.push({
        logId,
        reason: "hasil match belum punya studentId atau schoolId yang valid",
      });
      continue;
    }

    const patch = {};
    if (!currentStudentId) {
      patch.studentId = nextStudentId;
    }
    if (!currentSchoolId) {
      patch.schoolId = nextSchoolId;
    }
    if (!currentClass && nextClass) {
      patch.studentClass = nextClass;
    }

    if (Object.keys(patch).length === 0) continue;

    for (const [field, value] of Object.entries(patch)) {
      updates[`literacy_logs/${logId}/${field}`] = value;
    }

    patchable.push({
      logId,
      patch,
      matchedStudent: {
        nisn: matched.student.nisn,
        name: matched.student.name,
        className: matched.student.className,
        schoolId: matched.student.schoolId,
      },
      reason: matched.reason,
    });
  }

  console.log(`\nPatchable : ${patchable.length}`);
  patchable.forEach((item) => {
    console.log(
      `- ${item.logId}: ${JSON.stringify(item.patch)} <- ${item.matchedStudent.name} (${item.reason})`
    );
  });

  console.log(`\nSkipped   : ${skipped.length}`);
  skipped.forEach((item) => {
    console.log(`- ${item.logId}: ${item.reason}`);
  });

  if (!apply) {
    console.log("\nDry run selesai. Tambahkan --apply untuk menulis perubahan.");
    return;
  }

  if (Object.keys(updates).length === 0) {
    console.log("\nTidak ada perubahan yang perlu ditulis.");
    return;
  }

  await db.ref().update(updates);
  console.log(`\nSelesai. Total field yang diperbarui: ${Object.keys(updates).length}`);
}

main().catch((error) => {
  console.error("[FATAL]", error?.message || error);
  process.exit(1);
});
