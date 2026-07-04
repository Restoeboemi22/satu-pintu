const fs = require("fs");
const path = require("path");

const target = String(process.argv[2] || "").trim().toUpperCase();
const jsonPathArg = process.argv[3] || "";

if (!["GAS", "EDULOCK"].includes(target)) {
  console.error("Gunakan: node scripts/print-service-account-env.js GAS path\\ke\\service-account.json");
  console.error("Atau    : node scripts/print-service-account-env.js EDULOCK path\\ke\\service-account.json");
  process.exit(1);
}

if (!jsonPathArg) {
  console.error("Path service account JSON wajib diisi.");
  process.exit(1);
}

const jsonPath = path.resolve(process.cwd(), jsonPathArg);
if (!fs.existsSync(jsonPath)) {
  console.error(`File tidak ditemukan: ${jsonPath}`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const compact = JSON.stringify(raw);

console.log(`FIREBASE_ADMIN_${target}_SERVICE_ACCOUNT_JSON=${compact}`);
