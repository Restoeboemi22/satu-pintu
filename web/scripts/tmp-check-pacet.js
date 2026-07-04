const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.join(process.cwd(), "service-account.json"));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://edulock-4b7fc-default-rtdb.asia-southeast1.firebasedatabase.app"
  });
}
const db = admin.database();
(async () => {
  const schoolsSnap = await db.ref("schools").once("value");
  const schools = schoolsSnap.val() || {};
  const matchedSchools = Object.entries(schools)
    .filter(([k, v]) => {
      const name = String((v||{}).name || "").toLowerCase();
      const sid = String((v||{}).schoolId || k || "").toLowerCase();
      return name.includes("pacet") || sid.includes("pacet");
    })
    .map(([k, v]) => ({ key:k, ...(v||{}) }));

  const adminsSnap = await db.ref("admin_profiles").once("value");
  const admins = adminsSnap.val() || {};
  const matchedAdmins = Object.entries(admins)
    .filter(([k, v]) => {
      const obj = v || {};
      const schoolId = String(obj.schoolId || "").toLowerCase();
      const schoolName = String(obj.schoolName || "").toLowerCase();
      const email = String(obj.email || "").toLowerCase();
      const npsn = String(obj.npsn || "").toLowerCase();
      return schoolId.includes("pacet") || schoolName.includes("pacet") || email.includes("20555784") || npsn.includes("20555784");
    })
    .map(([k, v]) => ({ key:k, ...(v||{}) }));

  console.log("SCHOOLS_MATCH=", JSON.stringify(matchedSchools, null, 2));
  console.log("ADMINS_MATCH=", JSON.stringify(matchedAdmins, null, 2));
})();
