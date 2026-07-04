const fs = require("fs");
const path = require("path");

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  if (!hit) return fallback;
  return String(hit.slice(prefix.length)).trim();
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

function main() {
  const violationsPath = readArg("violations", "./tmp-violations.json");
  const studentsPath = readArg("students", "./tmp-students.json");
  const outputPath = readArg("output", "./tmp-violations-updates.json");
  const onlySchool = normalizeSchoolId(readArg("only-school"));

  const violations = loadJson(violationsPath);
  const students = loadJson(studentsPath);

  const schoolIdByNisn = new Map();
  if (students && typeof students === "object") {
    Object.entries(students).forEach(([nisn, value]) => {
      const row = value && typeof value === "object" ? value : {};
      const schoolId = normalizeSchoolId(row.schoolId);
      if (schoolId) schoolIdByNisn.set(String(nisn || "").trim(), schoolId);
    });
  }

  const updates = {};
  const unresolved = [];
  let total = 0;
  let linked = 0;
  let rootSchoolIdFilled = 0;

  if (violations && typeof violations === "object") {
    Object.entries(violations).forEach(([violationId, value]) => {
      total += 1;
      const row = value && typeof value === "object" ? value : {};
      const nisn = String(row.nisn || "").trim();
      const schoolId = normalizeSchoolId(row.schoolId || schoolIdByNisn.get(nisn));

      if (!schoolId) {
        unresolved.push({
          violationId,
          nisn,
          type: String(row.type || ""),
        });
        return;
      }

      if (onlySchool && schoolId !== onlySchool) return;

      const nextRow = {
        ...row,
        schoolId,
      };

      updates[`violations_by_school/${schoolId}/${violationId}`] = nextRow;
      linked += 1;

      if (!normalizeSchoolId(row.schoolId)) {
        updates[`violations/${violationId}/schoolId`] = schoolId;
        rootSchoolIdFilled += 1;
      }
    });
  }

  fs.writeFileSync(path.resolve(outputPath), JSON.stringify(updates, null, 2));

  console.log("=== BUILD VIOLATIONS BACKFILL UPDATES ===");
  console.log(`Violations file  : ${path.resolve(violationsPath)}`);
  console.log(`Students file    : ${path.resolve(studentsPath)}`);
  console.log(`Output file      : ${path.resolve(outputPath)}`);
  console.log(`Total violations : ${total}`);
  console.log(`Linked schoolId  : ${linked}`);
  console.log(`Fill root sid    : ${rootSchoolIdFilled}`);
  console.log(`Unresolved       : ${unresolved.length}`);

  if (unresolved.length > 0) {
    console.log("Contoh unresolved:");
    unresolved.slice(0, 20).forEach((item) => {
      console.log(`- ${item.violationId} | nisn=${item.nisn || "-"} | type=${item.type || "-"}`);
    });
  }
}

main();
