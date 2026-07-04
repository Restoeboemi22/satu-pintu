
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json.json');
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://smpn3pacet-app-default-rtdb.asia-southeast1.firebasedatabase.app"
    });
}

const db = admin.database();

(async () => {
    try {
        console.log("Fetching first 5 students...");
        const snapshot = await db.ref('students').limitToFirst(5).once('value');
        const data = snapshot.val();
        console.log("Student Data Sample:");
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error fetching students:", error);
    } finally {
        process.exit(0);
    }
})();
