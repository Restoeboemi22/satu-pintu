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

function printUsage() {
  console.log(`
Migrasi node RTDB lintas project Firebase

Contoh:
node scripts/migrate-rtdb-selected-nodes.js ^
  --source-service-account=./service-account.json ^
  --source-db-url=https://smpn3pacet-app-default-rtdb.asia-southeast1.firebasedatabase.app ^
  --target-service-account=./target-service-account.json ^
  --target-db-url=https://TARGET-default-rtdb.asia-southeast1.firebasedatabase.app ^
  --nodes=schools,npsn_index,principal_accounts ^
  --dry-run

Argumen wajib:
  --source-service-account
  --source-db-url
  --target-service-account
  --target-db-url
  --nodes               daftar node dipisah koma

Flag opsional:
  --dry-run             hanya baca dan hitung, tanpa menulis ke target
`);
}

async function initAdminApp(name, serviceAccountPath, databaseURL) {
  const serviceAccount = loadJson(serviceAccountPath);
  try {
    return admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
        databaseURL,
      },
      name
    );
  } catch (error) {
    return admin.app(name);
  }
}

async function main() {
  const sourceServiceAccountPath = readArg("source-service-account");
  const sourceDbUrl = readArg("source-db-url");
  const targetServiceAccountPath = readArg("target-service-account");
  const targetDbUrl = readArg("target-db-url");
  const nodes = readArg("nodes")
    .split(",")
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  const dryRun = hasFlag("dry-run");

  if (!sourceServiceAccountPath || !sourceDbUrl || !targetServiceAccountPath || !targetDbUrl || nodes.length === 0) {
    printUsage();
    process.exit(1);
  }

  console.log("=== MIGRASI RTDB SELECTED NODES ===");
  console.log(`Mode        : ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Source DB   : ${sourceDbUrl}`);
  console.log(`Target DB   : ${targetDbUrl}`);
  console.log(`Nodes       : ${nodes.join(", ")}`);

  const sourceApp = await initAdminApp("migration-source", sourceServiceAccountPath, sourceDbUrl);
  const targetApp = await initAdminApp("migration-target", targetServiceAccountPath, targetDbUrl);

  const sourceDb = admin.database(sourceApp);
  const targetDb = admin.database(targetApp);

  const summary = [];

  for (const node of nodes) {
    console.log(`\n[MULAI] Membaca node "${node}" dari source...`);
    const snap = await sourceDb.ref(node).get();
    const value = snap.exists() ? snap.val() : null;

    const count =
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.keys(value).length
        : value == null
          ? 0
          : 1;

    console.log(`[INFO] Node "${node}" terbaca. Estimasi item: ${count}`);
    summary.push({ node, count, exists: value !== null });

    if (dryRun) continue;

    console.log(`[TULIS] Menulis node "${node}" ke target...`);
    await targetDb.ref(node).set(value);
    console.log(`[OK] Node "${node}" selesai ditulis.`);
  }

  console.log("\n=== RINGKASAN ===");
  for (const item of summary) {
    console.log(`- ${item.node}: ${item.exists ? `${item.count} item` : "kosong/null"}`);
  }

  console.log("\nSelesai.");
}

main().catch((error) => {
  console.error("[FATAL]", error?.message || error);
  process.exit(1);
});

