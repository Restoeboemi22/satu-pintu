const fs = require("fs");
const path = require("path");

const inputArg = process.argv[2] || "scripts/data/schools.bootstrap.template.csv";
const outputSeedArg = process.argv[3] || "scripts/data/edulock_seed.generated.json";
const outputAdminsArg = process.argv[4] || "scripts/data/admin_bootstrap.generated.csv";

const rootDir = path.resolve(__dirname, "..");
const inputPath = path.resolve(rootDir, inputArg);
const outputSeedPath = path.resolve(rootDir, outputSeedArg);
const outputAdminsPath = path.resolve(rootDir, outputAdminsArg);

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeBool(value) {
  const raw = normalizeText(value).toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
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
    throw new Error("CSV minimal harus berisi header dan satu baris data.");
  }

  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const row = {};
    header.forEach((key, keyIndex) => {
      row[key] = values[keyIndex] || "";
    });
    row.__rowNumber = index + 2;
    return row;
  });
}

function ensureUnique(rows, fieldName) {
  const seen = new Set();
  rows.forEach((row) => {
    const value = normalizeText(row[fieldName]);
    if (!value) {
      throw new Error(`Kolom ${fieldName} wajib diisi pada baris ${row.__rowNumber}.`);
    }
    if (seen.has(value)) {
      throw new Error(`Nilai duplikat ${fieldName}="${value}" ditemukan pada baris ${row.__rowNumber}.`);
    }
    seen.add(value);
  });
}

function main() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`File input tidak ditemukan: ${inputPath}`);
  }

  const rows = parseCsv(fs.readFileSync(inputPath, "utf8"));
  ensureUnique(rows, "schoolId");
  ensureUnique(rows, "npsn");

  const seed = {
    schools: {},
    npsn_index: {},
  };

  const adminLines = [
    "schoolId,schoolName,npsn,systemEmail,defaultPassword,role,isActive",
  ];

  rows.forEach((row) => {
    const schoolId = normalizeText(row.schoolId);
    const schoolName = normalizeText(row.schoolName);
    const npsn = normalizeText(row.npsn);
    const district = normalizeText(row.district);
    const sortIndexRaw = normalizeText(row.sortIndex);
    const sortIndex = Number(sortIndexRaw || "0");
    const authEmail = normalizeText(row.authEmail || `${npsn}@edulock.local`).toLowerCase();
    const adminEmail = normalizeText(row.adminEmail).toLowerCase();
    const backupEmail = normalizeText(row.backupEmail).toLowerCase();
    const isActive = normalizeBool(row.isActive || "true");
    const now = Date.now();

    if (!schoolName) {
      throw new Error(`Kolom schoolName wajib diisi pada baris ${row.__rowNumber}.`);
    }

    seed.schools[schoolId] = {
      id: schoolId,
      schoolId,
      name: schoolName,
      district,
      npsn,
      authEmail,
      adminEmail,
      backupEmail,
      isActive,
      createdAt: now,
      updatedAt: now,
      sortIndex: Number.isFinite(sortIndex) ? sortIndex : 0,
    };

    seed.npsn_index[npsn] = schoolId;

    adminLines.push(
      [
        schoolId,
        schoolName,
        npsn,
        `${npsn}@edulock.local`,
        "admin123",
        "admin",
        isActive ? "true" : "false",
      ].join(",")
    );
  });

  fs.mkdirSync(path.dirname(outputSeedPath), { recursive: true });
  fs.writeFileSync(outputSeedPath, JSON.stringify(seed, null, 2));
  fs.writeFileSync(outputAdminsPath, `${adminLines.join("\n")}\n`);

  console.log("Bootstrap EduLock berhasil dibuat.");
  console.log(`- Seed RTDB  : ${outputSeedPath}`);
  console.log(`- Admin CSV  : ${outputAdminsPath}`);
  console.log(`- Total sekolah: ${rows.length}`);
}

try {
  main();
} catch (error) {
  console.error("[GAGAL]", error.message || error);
  process.exit(1);
}
